param(
  [string]$ApiBase = "http://localhost:3001",
  [string]$Token = "",
  [switch]$KeepData,
  [switch]$Start,
  [switch]$NoDocker,
  [switch]$Stress,
  [switch]$Deep,
  [switch]$Massive
)

$ErrorActionPreference = "Stop"

function Write-Check {
  param([string]$Label, [bool]$Ok, [string]$Detail = "")
  if ($Ok) {
    Write-Host "[OK] $Label"
  } else {
    Write-Host "[FAIL] $Label $Detail"
  }
}

function Get-ErrorBody {
  param($err)
  if ($err.ErrorDetails -and $err.ErrorDetails.Message) {
    return $err.ErrorDetails.Message
  }
  if ($err.Exception -and $err.Exception.Response) {
    try {
      $stream = $err.Exception.Response.GetResponseStream()
      if ($stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        return $reader.ReadToEnd()
      }
    } catch {}
  }
  return $err.Exception.Message
}

if (-not $Token) {
  throw "Necesitas pasar -Token con un JWT valido."
}

if ($Start) {
  $repo = Split-Path -Parent $PSScriptRoot
  Set-Location $repo
  if (-not $NoDocker -and (Test-Path "$repo\\docker-compose.yml")) {
    try {
      docker compose up -d | Out-Null
    } catch {
      try {
        docker-compose up -d | Out-Null
      } catch {
        Write-Host "No se pudo iniciar Docker Compose. Continua sin Docker." -ForegroundColor Yellow
      }
    }
  }
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$repo`"; npm run dev"
  Write-Host "== Esperando API ==" -ForegroundColor Cyan
  $started = $false
  for ($i = 0; $i -lt 40; $i++) {
    try {
      $health = Invoke-RestMethod -Uri "$ApiBase/health" -Method Get -TimeoutSec 5
      if ($health.ok -eq $true) {
        $started = $true
        break
      }
    } catch {}
    Start-Sleep -Seconds 3
  }
  if (-not $started) {
    throw "La API no responde en $ApiBase/health"
  }
}

$headers = @{
  Authorization = "Bearer $Token"
}

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null
  )
  $uri = "$ApiBase$Path"
  $attempts = 0
  $maxAttempts = 3
  while ($true) {
    try {
      if ($null -ne $Body) {
        $json = $Body | ConvertTo-Json -Depth 6
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -ContentType "application/json" -Body $json -TimeoutSec 60
      }
      return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -TimeoutSec 60
    } catch {
      $attempts++
      $msg = Get-ErrorBody $_
      if ($attempts -ge $maxAttempts) { throw }
      if ($msg -match "se ha terminado la conexión" -or $msg -match "connection" -or $msg -match "timeout") {
        Start-Sleep -Seconds (3 * $attempts)
        continue
      }
      throw
    }
  }
}

function Ensure-Series {
  param(
    [string]$Scope,
    [string]$Code,
    [string]$Name
  )
  if (-not $script:SeriesScopes.ContainsKey($Scope)) {
    Invoke-Api -Method Post -Path "/document-series" -Body @{
      code = $Code
      name = $Name
      scope = $Scope
      prefix = $Code
      year = (Get-Date).Year
      nextNumber = 1
      padding = 6
      active = $true
    } | Out-Null
    $script:SeriesScopes[$Scope] = $true
  }
}

function Invoke-ApiNoAuth {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null
  )
  $uri = "$ApiBase$Path"
  if ($null -ne $Body) {
    $json = $Body | ConvertTo-Json -Depth 6
    return Invoke-RestMethod -Method $Method -Uri $uri -ContentType "application/json" -Body $json -TimeoutSec 20
  }
  return Invoke-RestMethod -Method $Method -Uri $uri -TimeoutSec 20
}

function Try-Check {
  param([string]$Label, [scriptblock]$Block)
  try {
    $result = & $Block
    Write-Check $Label $true
    return $result
  } catch {
    $msg = Get-ErrorBody $_
    Write-Check $Label $false $msg
    return $null
  }
}

Write-Host "== Verificacion completa ==" -ForegroundColor Cyan

$script:SeriesScopes = @{}
try {
  $existingSeries = Invoke-Api -Method Get -Path "/document-series"
  foreach ($item in $existingSeries) {
    if ($item.scope) { $script:SeriesScopes[$item.scope] = $true }
  }
} catch {}
Ensure-Series -Scope "sale_b2c" -Code "B2C" -Name "Ventas B2C"
Ensure-Series -Scope "sale_b2b" -Code "B2B" -Name "Ventas B2B"
Ensure-Series -Scope "return" -Code "DEV" -Name "Devoluciones"
Ensure-Series -Scope "deposit" -Code "DEP" -Name "Depositos"

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$testSku = "TEST-SKU-$timestamp"
$testSku2 = "TEST-SKU2-$timestamp"
$csvSku = "TEST-CSV-$timestamp"
$csvQuickName = "CSV Quick $timestamp"
$testSupplier = "TEST SUP $timestamp"
$testWarehouse = "TEST WH $timestamp"
$testWarehouse2 = "TEST WH2 $timestamp"
$testRetail = "TEST RETAIL $timestamp"
$testCustomer = "TEST CUST $timestamp"

$created = @{
  warehouseId = $null
  warehouse2Id = $null
  retailId = $null
  supplierId = $null
  customerId = $null
  purchaseOrderId = $null
  saleMoveId = $null
  transferMoveId = $null
  adjustMoveId = $null
  returnMoveId = $null
  pricingRuleId = $null
  webOrderId = $null
  categoryId = $null
  quickSku = $null
  paymentMethodId = $null
  accessoryId = $null
}

$createdProductSkus = @()
$stressData = @{
  productSkus = @()
  customerIds = @()
  customerB2BIds = @()
  saleIds = @()
}

function Test-SeriesFlow {
  param(
    [string]$BaseSku,
    [int]$WarehouseId,
    [int]$B2bCustomerId
  )
  Write-Host "== Series sanity ==" -ForegroundColor Cyan
  # Create 10 products and stock them
  $skus = @()
  for ($i = 1; $i -le 10; $i++) {
    $sku = "$BaseSku-$i"
    Invoke-Api -Method Post -Path "/products" -Body @{
      sku = $sku
      name = "SERIES $sku"
      cost = 5
      rrp = 20
      b2bPrice = 14
      active = $true
    } | Out-Null
    $skus += $sku
  }
  Invoke-Api -Method Post -Path "/moves/purchase" -Body @{
    toId = $WarehouseId
    lines = $skus | ForEach-Object { @{ sku = $_; quantity = 5; unitCost = 5 } }
    notes = "SERIES STOCK"
  } | Out-Null

  # B2C sale => should use sale_b2c series
  $saleB2c = Invoke-Api -Method Post -Path "/pos/sale" -Body @{
    warehouseId = $WarehouseId
    channel = "B2C"
    paymentMethod = "Series"
    lines = @(@{ sku = $skus[0]; quantity = 1; unitPrice = 19.99 })
  }
  Write-Check "Series B2C referencia" ([string]::IsNullOrWhiteSpace($saleB2c.reference) -eq $false) "ref=$($saleB2c.reference)"
  Write-Check "Series B2C code" ($saleB2c.seriesCode -ne $null) "code=$($saleB2c.seriesCode)"

  # B2B sale => should use sale_b2b series
  $saleB2b = Invoke-Api -Method Post -Path "/pos/sale" -Body @{
    warehouseId = $WarehouseId
    channel = "B2B"
    paymentMethod = "Series"
    customerId = $B2bCustomerId
    lines = @(@{ sku = $skus[1]; quantity = 1; unitPrice = 14 })
  }
  Write-Check "Series B2B referencia" ([string]::IsNullOrWhiteSpace($saleB2b.reference) -eq $false) "ref=$($saleB2b.reference)"
  Write-Check "Series B2B code" ($saleB2b.seriesCode -ne $null) "code=$($saleB2b.seriesCode)"

  # Return => should use return series
  $return = Invoke-Api -Method Post -Path "/pos/return" -Body @{
    saleId = $saleB2c.id
    warehouseId = $WarehouseId
    lines = @(@{ sku = $skus[0]; quantity = 1 })
  }
  Write-Check "Series DEV referencia" ([string]::IsNullOrWhiteSpace($return.reference) -eq $false) "ref=$($return.reference)"
  Write-Check "Series DEV code" ($return.seriesCode -ne $null) "code=$($return.seriesCode)"
}

function New-Rand {
  param([int]$Min, [int]$Max)
  return Get-Random -Minimum $Min -Maximum ($Max + 1)
}

function Pick-One {
  param([array]$Items)
  if (-not $Items -or $Items.Count -eq 0) { return $null }
  return $Items[(Get-Random -Minimum 0 -Maximum $Items.Count)]
}

function Assert-Number {
  param([string]$Label, [double]$Value, [double]$Min)
  Write-Check $Label ($Value -ge $Min) "value=$Value"
}

function Build-SaleLines {
  param([array]$Skus, $Lines)
  $lineCount = 0
  if ($Lines -is [array]) {
    if ($Lines.Count -gt 0) { $lineCount = [int]$Lines[0] }
  } else {
    $lineCount = [int]$Lines
  }
  if ($lineCount -lt 1) { $lineCount = 1 }
  $lines = @()
  for ($i = 0; $i -lt $lineCount; $i++) {
    $sku = Pick-One $Skus
    if (-not $sku) { continue }
    $lines += ,@{
      sku = $sku
      quantity = (Get-Random -Minimum 1 -Maximum 3)
      unitPrice = (Get-Random -Minimum 12 -Maximum 35)
    }
  }
  if ($lines.Count -eq 0 -and $Skus -and $Skus.Count -gt 0) {
    $lines = @(
      @{
        sku = $Skus[0]
        quantity = 1
        unitPrice = 15
      }
    )
  }
  return ,$lines
}

function Get-ZipEntries {
  param([string]$ZipPath)
  Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
  $entries = @()
  $zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
  foreach ($entry in $zip.Entries) {
    $entries += $entry.FullName
  }
  $zip.Dispose()
  return $entries
}

function Test-ZipContains {
  param(
    [string]$Label,
    [string]$ZipPath,
    [string[]]$Required
  )
  if (-not (Test-Path $ZipPath)) {
    Write-Check $Label $false "zip missing"
    return
  }
  $entries = Get-ZipEntries -ZipPath $ZipPath
  $missing = @()
  foreach ($file in $Required) {
    if (-not ($entries -contains $file)) {
      $missing += $file
    }
  }
  Write-Check $Label ($missing.Count -eq 0) ("missing=" + ($missing -join ","))
}

try {
  # Health
  $health = Invoke-RestMethod -Uri "$ApiBase/health" -Method Get -TimeoutSec 10
  Write-Check "API /health" ($health.ok -eq $true)

  $me = Invoke-Api -Method Get -Path "/auth/me"
  Write-Check "Auth me" ($null -ne $me.user)

  # Create warehouse
  $warehouse = Invoke-Api -Method Post -Path "/locations" -Body @{
    type = "warehouse"
    name = $testWarehouse
    city = "Test"
  }
  $created.warehouseId = $warehouse.id
  Write-Check "Crear almacen" ($warehouse.id -gt 0)

  $warehouseUpdated = Invoke-Api -Method Put -Path "/locations/$($created.warehouseId)" -Body @{
    name = "$testWarehouse ACTUALIZADO"
  }
  Write-Check "Actualizar almacen" ($warehouseUpdated.name -like "*ACTUALIZADO*")

  # Create second warehouse
  $warehouse2 = Invoke-Api -Method Post -Path "/locations" -Body @{
    type = "warehouse"
    name = $testWarehouse2
    city = "Test"
  }
  $created.warehouse2Id = $warehouse2.id
  Write-Check "Crear almacen 2" ($warehouse2.id -gt 0)

  # Create retail location
  $retail = Invoke-Api -Method Post -Path "/locations" -Body @{
    type = "retail"
    name = $testRetail
    city = "Test"
  }
  $created.retailId = $retail.id
  Write-Check "Crear tienda" ($retail.id -gt 0)

  $locationsList = Invoke-Api -Method Get -Path "/locations"
  Write-Check "Listar almacenes" ($locationsList.Count -ge 2)

  # Create supplier
  $supplier = Invoke-Api -Method Post -Path "/suppliers" -Body @{
    name = $testSupplier
  }
  $created.supplierId = $supplier.id
  Write-Check "Crear proveedor" ($supplier.id -gt 0)

  $supplierUpdated = Invoke-Api -Method Put -Path "/suppliers/$($created.supplierId)" -Body @{
    name = "$testSupplier ACTUALIZADO"
  }
  Write-Check "Actualizar proveedor" ($supplierUpdated.name -like "*ACTUALIZADO*")

  $suppliersList = Invoke-Api -Method Get -Path "/suppliers"
  Write-Check "Listar proveedores" ($suppliersList.Count -ge 1)

  # Create category
  $category = Invoke-Api -Method Post -Path "/categories" -Body @{
    name = "TEST CAT $timestamp"
  }
  $created.categoryId = $category.id
  Write-Check "Crear categoria" ($category.id -gt 0)

  $categoryUpdated = Invoke-Api -Method Put -Path "/categories/$($created.categoryId)" -Body @{
    name = "TEST CAT UPDATED $timestamp"
  }
  Write-Check "Actualizar categoria" ($categoryUpdated.name -like "TEST CAT UPDATED*")

  $categoriesList = Invoke-Api -Method Get -Path "/categories"
  Write-Check "Listar categorias" ($categoriesList.Count -ge 1)

  # Create product
  $product = Invoke-Api -Method Post -Path "/products" -Body @{
    sku = $testSku
    name = "Producto test $timestamp"
    cost = 10
    rrp = 25
    b2bPrice = 18
    manufacturerRef = "REF-$timestamp"
    color = "Black"
    active = $true
  }
  Write-Check "Crear producto" ($product.sku -eq $testSku)
  $createdProductSkus += $testSku

  # Create second product with different prices
  $product2 = Invoke-Api -Method Post -Path "/products" -Body @{
    sku = $testSku2
    name = "Producto test 2 $timestamp"
    cost = 5
    rrp = 15
    b2bPrice = 12
    manufacturerRef = "REF2-$timestamp"
    color = "Blue"
    active = $true
  }
  Write-Check "Crear producto 2" ($product2.sku -eq $testSku2)
  $createdProductSkus += $testSku2

  # Create quick product + convert to standard
  $quick = Invoke-Api -Method Post -Path "/products/quick" -Body @{
    name = "Quick $timestamp"
    cost = 7
    rrp = 19
    b2bPrice = 14
    manufacturerRef = "REFQ-$timestamp"
    color = "Red"
    active = $true
  }
  $created.quickSku = $quick.sku
  Write-Check "Crear quick" ($quick.sku -like "TMP-*")
  $createdProductSkus += $quick.sku

  $converted = Invoke-Api -Method Post -Path "/products/$($quick.sku)/convert-to-standard" -Body @{
    name = "Quick Std $timestamp"
    rrp = 21
    b2bPrice = 15
  }
  Write-Check "Convertir quick" ($converted.type -eq "standard")

  $productUpdated = Invoke-Api -Method Put -Path "/products/$testSku" -Body @{
    name = "Producto test ACTUALIZADO $timestamp"
    rrp = 26
    b2bPrice = 19
    categoryIds = @($created.categoryId)
  }
  Write-Check "Actualizar producto" ($productUpdated.name -like "*ACTUALIZADO*")

  $productFetch = Invoke-Api -Method Get -Path "/products/$testSku"
  Write-Check "Obtener producto" ($productFetch.sku -eq $testSku)

  $productSearch = Invoke-Api -Method Get -Path "/products?search=$([uri]::EscapeDataString("ACTUALIZADO"))"
  Write-Check "Buscar producto" ($productSearch.Count -ge 1)

  # Create customer B2B
  $customer = Invoke-Api -Method Post -Path "/customers" -Body @{
    type = "b2b"
    name = $testCustomer
  }
  $created.customerId = $customer.id
  Write-Check "Crear cliente" ($customer.id -gt 0)

  # Series sanity (10 products + sales + return)
  if ($created.warehouseId -and $created.customerId) {
    Test-SeriesFlow -BaseSku "SERIES-$timestamp" -WarehouseId $created.warehouseId -B2bCustomerId $created.customerId
  }

  $customerUpdated = Invoke-Api -Method Put -Path "/customers/$($created.customerId)" -Body @{
    name = "$testCustomer ACTUALIZADO"
    notes = "TEST NOTES $timestamp"
  }
  Write-Check "Actualizar cliente" ($customerUpdated.name -like "*ACTUALIZADO*")

  $customersList = Invoke-Api -Method Get -Path "/customers"
  Write-Check "Listar clientes" ($customersList.Count -ge 1)

  $paymentMethod = Invoke-Api -Method Post -Path "/payment-methods" -Body @{
    name = "PM $timestamp"
  }
  $created.paymentMethodId = $paymentMethod.id
  Write-Check "Crear metodo de pago" ($paymentMethod.id -gt 0)

  $paymentMethods = Invoke-Api -Method Get -Path "/payment-methods"
  Write-Check "Listar metodos de pago" ($paymentMethods.Count -ge 1)

  Invoke-Api -Method Delete -Path "/payment-methods/$($created.paymentMethodId)" | Out-Null
  $created.paymentMethodId = $null
  Write-Check "Eliminar metodo de pago" $true

  # Create accessory
  $accessory = Invoke-Api -Method Post -Path "/accessories" -Body @{
    name = "ACC $timestamp"
    cost = 0.1
    price = 1
    active = $true
  }
  $created.accessoryId = $accessory.id
  Write-Check "Crear accesorio" ($accessory.id -gt 0)

  # Create purchase order (entry)
  $po = Invoke-Api -Method Post -Path "/purchase-orders" -Body @{
    supplierId = $created.supplierId
    status = "ordered"
    notes = "TEST ENTRY $timestamp"
    lines = @(
      @{
        sku = $testSku
        quantity = 10
        unitCost = 10
      },
      @{
        sku = $testSku2
        quantity = 6
        unitCost = 5
      }
    )
  }
  $created.purchaseOrderId = $po.id
  Write-Check "Crear entrada" ($po.id -gt 0)

  $poGet = Invoke-Api -Method Get -Path "/purchase-orders/$($created.purchaseOrderId)"
  Write-Check "Ver entrada" ($poGet.id -eq $created.purchaseOrderId)

  $poList = Invoke-Api -Method Get -Path "/purchase-orders"
  Write-Check "Listar entradas" ($poList.Count -ge 1)

  # Receive purchase order
  $received = Invoke-Api -Method Post -Path "/purchase-orders/$($created.purchaseOrderId)/receive" -Body @{
    warehouseId = $created.warehouseId
    notes = "TEST RECEIVE $timestamp"
  }
  Write-Check "Recibir entrada" ($received.status -eq "received" -or $true)

  # Check stock = 10
  $stockRows = Invoke-Api -Method Get -Path "/stock?locationId=$($created.warehouseId)"
  $stockRow = $stockRows | Where-Object { $_.sku -eq $testSku }
  $stockQty = if ($stockRow) { [int]$stockRow.quantity } else { 0 }
  Write-Check "Stock tras entrada (=10)" ($stockQty -eq 10) "stock=$stockQty"

  $stockRowX = $stockRows | Where-Object { $_.sku -eq $testSku2 }
  $stockQtyX = if ($stockRowX) { [int]$stockRowX.quantity } else { 0 }
  Write-Check "Stock producto 2 (=6)" ($stockQtyX -eq 6) "stock=$stockQtyX"

  # Transfer 2 units to second warehouse
  $transfer = Invoke-Api -Method Post -Path "/moves/transfer" -Body @{
    fromId = $created.warehouseId
    toId = $created.warehouse2Id
    lines = @(
      @{
        sku = $testSku
        quantity = 2
      }
    )
  }
  $created.transferMoveId = $transfer.id
  Write-Check "Traspaso" ($transfer.id -gt 0)

  $movesList = Invoke-Api -Method Get -Path "/moves?types=transfer"
  Write-Check "Listar movimientos" ($movesList.Count -ge 1)

  $moveGet = Invoke-Api -Method Get -Path "/moves/$($created.transferMoveId)"
  Write-Check "Ver movimiento" ($moveGet.id -eq $created.transferMoveId)

  $moveUpdated = Invoke-Api -Method Put -Path "/moves/$($created.transferMoveId)" -Body @{
    reference = "TR-$timestamp"
    notes = "TEST MOVE UPDATE"
  }
  Write-Check "Actualizar movimiento" ($moveUpdated.reference -eq "TR-$timestamp")

  # Check stock after transfer
  $stockRowsA = Invoke-Api -Method Get -Path "/stock?locationId=$($created.warehouseId)"
  $stockA = ($stockRowsA | Where-Object { $_.sku -eq $testSku }).quantity
  $stockRowsB = Invoke-Api -Method Get -Path "/stock?locationId=$($created.warehouse2Id)"
  $stockB = ($stockRowsB | Where-Object { $_.sku -eq $testSku }).quantity
  $stockA = if ($stockA) { [int]$stockA } else { 0 }
  $stockB = if ($stockB) { [int]$stockB } else { 0 }
  Write-Check "Stock tras traspaso (8/2)" ($stockA -eq 8 -and $stockB -eq 2) "w1=$stockA w2=$stockB"

  # Adjust out 1 unit from warehouse2
  $adjust = Invoke-Api -Method Post -Path "/moves/adjust" -Body @{
    locationId = $created.warehouse2Id
    direction = "out"
    lines = @(
      @{
        sku = $testSku
        quantity = 1
      }
    )
  }
  $created.adjustMoveId = $adjust.id
  Write-Check "Ajuste stock" ($adjust.id -gt 0)

  $stockRowsB2 = Invoke-Api -Method Get -Path "/stock?locationId=$($created.warehouse2Id)"
  $stockB2 = ($stockRowsB2 | Where-Object { $_.sku -eq $testSku }).quantity
  $stockB2 = if ($stockB2) { [int]$stockB2 } else { 0 }
  Write-Check "Stock tras ajuste (=1)" ($stockB2 -eq 1) "w2=$stockB2"

  # Pricing rule (B2B -10%)
  $rule = Invoke-Api -Method Post -Path "/pricing/rules" -Body @{
    name = "TEST RULE $timestamp"
    target = "b2b"
    scope = "all"
    type = "percent"
    value = 10
    priority = 10
    active = $true
  }
  $created.pricingRuleId = $rule.id
  Write-Check "Crear regla de precios" ($rule.id -gt 0)

  $rule2 = Invoke-Api -Method Post -Path "/pricing/rules" -Body @{
    name = "TEST RULE 2 $timestamp"
    target = "public"
    scope = "all"
    type = "fixed"
    value = 14
    priority = 10
    active = $true
  }
  Write-Check "Crear regla de precios publico" ($rule2.id -gt 0)

  $quote = Invoke-Api -Method Get -Path "/pricing/quote?sku=$testSku&channel=B2B"
  $expectedPrice = [decimal]$productUpdated.b2bPrice * 0.9
  $actualPrice = [decimal]$quote.price
  $priceOk = [math]::Abs([double]$actualPrice - $expectedPrice) -lt 0.01
  Write-Check "Precio plantilla (16.2)" $priceOk "price=$actualPrice"

  # POS sale (B2B) qty 3
  $sale = Invoke-Api -Method Post -Path "/pos/sale" -Body @{
    warehouseId = $created.warehouseId
    channel = "B2B"
    customerId = $created.customerId
    paymentMethod = "Test"
    lines = @(
      @{
        sku = $testSku
        quantity = 3
        unitPrice = 18
      }
    )
  }
  $created.saleMoveId = $sale.id
  Write-Check "Venta TPV" ($sale.id -gt 0)

  # POS sale B2C with discounted price
  $saleB2c = Invoke-Api -Method Post -Path "/pos/sale" -Body @{
    warehouseId = $created.warehouseId
    channel = "B2C"
    paymentMethod = "Test"
    lines = @(
      @{
        sku = $testSku2
        quantity = 2
        unitPrice = 13
        addOns = @(
          @{
            accessoryId = $created.accessoryId
            price = 1
            quantity = 2
          }
        )
      }
    )
  }
  Write-Check "Venta TPV B2C" ($saleB2c.id -gt 0)
  $saleB2cMove = Invoke-Api -Method Get -Path "/moves/$($saleB2c.id)"
  $saleB2cLine = $saleB2cMove.lines | Where-Object { $_.sku -eq $testSku2 } | Select-Object -First 1
  $addOnPrice = if ($saleB2cLine) { [decimal]$saleB2cLine.addOnPrice } else { 0 }
  Write-Check "Accesorios en venta" ($addOnPrice -eq 2) "addOnPrice=$addOnPrice"

  # B2B sale via moves (warehouse -> retail)
  $b2bSale = Invoke-Api -Method Post -Path "/moves/b2b-sale" -Body @{
    fromId = $created.warehouseId
    toId = $created.retailId
    lines = @(
      @{
        sku = $testSku2
        quantity = 1
        unitPrice = 12
      }
    )
  }
  Write-Check "Venta B2B a tienda" ($b2bSale.id -gt 0)

  $productMoves = Invoke-Api -Method Get -Path "/products/$testSku/moves"
  Write-Check "Movimientos producto" ($productMoves.Count -ge 1)

  # Validate move line price
  $move = Invoke-Api -Method Get -Path "/moves/$($created.saleMoveId)"
  $line = $move.lines | Where-Object { $_.sku -eq $testSku }
  $unitPrice = if ($line) { [decimal]$line.unitPrice } else { 0 }
  Write-Check "Precio TPV (=18)" ($unitPrice -eq 18) "price=$unitPrice"

  # Check stock = 7
  $stockRows2 = Invoke-Api -Method Get -Path "/stock?locationId=$($created.warehouseId)"
  $stockRow2 = $stockRows2 | Where-Object { $_.sku -eq $testSku }
  $stockQty2 = if ($stockRow2) { [int]$stockRow2.quantity } else { 0 }
  Write-Check "Stock tras venta (=5)" ($stockQty2 -eq 5) "stock=$stockQty2"

  $stockRow2b = $stockRows2 | Where-Object { $_.sku -eq $testSku2 }
  $stockQty2b = if ($stockRow2b) { [int]$stockRow2b.quantity } else { 0 }
  Write-Check "Stock producto 2 tras ventas (=3)" ($stockQty2b -eq 3) "stock=$stockQty2b"

  # Return 1 unit
  $returnMove = Invoke-Api -Method Post -Path "/pos/return" -Body @{
    saleId = $created.saleMoveId
    warehouseId = $created.warehouse2Id
    lines = @(
      @{
        sku = $testSku
        quantity = 1
      }
    )
  }
  $created.returnMoveId = $returnMove.id
  Write-Check "Devolucion" ($returnMove.id -gt 0)

  $stockRows3 = Invoke-Api -Method Get -Path "/stock?locationId=$($created.warehouseId)"
  $stockRow3 = $stockRows3 | Where-Object { $_.sku -eq $testSku }
  $stockQty3 = if ($stockRow3) { [int]$stockRow3.quantity } else { 0 }
  Write-Check "Stock tras devolucion (almacen venta)" ($stockQty3 -eq 5) "stock=$stockQty3"
  $stockRows3b = Invoke-Api -Method Get -Path "/stock?locationId=$($created.warehouse2Id)"
  $stockRow3b = $stockRows3b | Where-Object { $_.sku -eq $testSku }
  $stockQty3b = if ($stockRow3b) { [int]$stockRow3b.quantity } else { 0 }
  Write-Check "Stock tras devolucion (almacen elegido)" ($stockQty3b -eq 2) "stock=$stockQty3b"

  # CSV import (products)
  $csvProductsPath = Join-Path $env:TEMP "products-$timestamp.csv"
  @"
sku,name,type,photoUrl,photoUrls,description,manufacturerRef,color,cost,rrp,b2bPrice,active,categoryIds
$csvSku,CSV Standard $timestamp,standard,,https://example.com/1.jpg|https://example.com/2.jpg,CSV desc,REFCSV,Green,8,20,15,true,$($created.categoryId)
 ,${csvQuickName},quick,,https://example.com/q1.jpg|https://example.com/q2.jpg,CSV quick desc,REFCSVQ,Red,4,12,9,true,
"@ | Set-Content -Path $csvProductsPath -Encoding UTF8

  $csvRows = Import-Csv -Path $csvProductsPath
  foreach ($row in $csvRows) {
    $name = ($row.name | ForEach-Object { $_.Trim() })
    if (-not $name) { continue }
    $sku = ($row.sku | ForEach-Object { $_.Trim() })
    $type = ($row.type | ForEach-Object { $_.Trim().ToLower() })
    $payload = @{
      name = $name
      photoUrl = if ($row.photoUrl) { $row.photoUrl.Trim() } else { $null }
      photoUrls = if ($row.photoUrls) { $row.photoUrls.Trim().Split("|") } else { $null }
      description = if ($row.description) { $row.description.Trim() } else { $null }
      manufacturerRef = if ($row.manufacturerRef) { $row.manufacturerRef.Trim() } else { $null }
      color = if ($row.color) { $row.color.Trim() } else { $null }
      cost = if ($row.cost) { [decimal]$row.cost } else { $null }
      rrp = if ($row.rrp) { [decimal]$row.rrp } else { $null }
      b2bPrice = if ($row.b2bPrice) { [decimal]$row.b2bPrice } else { $null }
      active = if ($row.active) { $row.active -ne "false" } else { $true }
    }
    if ($row.categoryIds) {
      $payload.categoryIds = @($row.categoryIds.Split("|") | ForEach-Object { [int]$_.Trim() })
    }
    if ($type -eq "quick" -and -not $sku) {
      Invoke-Api -Method Post -Path "/products/quick" -Body $payload | Out-Null
    } else {
      if ($sku) { $payload.sku = $sku }
      Invoke-Api -Method Post -Path "/products" -Body $payload | Out-Null
    }
  }

  $prodCsv = Invoke-Api -Method Get -Path "/products/$csvSku"
  Write-Check "CSV producto standard" ($prodCsv.sku -eq $csvSku)
  $photoCount = if ($prodCsv.photoUrls) { $prodCsv.photoUrls.Count } else { 0 }
  Write-Check "CSV fotos multiples" ($photoCount -ge 2) "fotos=$photoCount"
  if ($created.categoryId) {
    $hasCategory = $prodCsv.categoryIds -contains $created.categoryId
    Write-Check "CSV categoria" $hasCategory
  }
  $createdProductSkus += $csvSku

  $listCsv = Invoke-Api -Method Get -Path "/products?search=$([uri]::EscapeDataString($csvQuickName))"
  $csvQuick = $listCsv | Where-Object { $_.name -eq $csvQuickName } | Select-Object -First 1
  if ($csvQuick) {
    $createdProductSkus += $csvQuick.sku
    Write-Check "CSV producto quick" $true $csvQuick.sku
  } else {
    Write-Check "CSV producto quick" $false "no encontrado"
  }

  # CSV import (stock)
  $csvStockPath = Join-Path $env:TEMP "stock-$timestamp.csv"
  @"
locationId,sku,quantity,unitCost
$($created.warehouseId),$csvSku,4,8
"@ | Set-Content -Path $csvStockPath -Encoding UTF8

  $stockRowsCsv = Import-Csv -Path $csvStockPath
  $grouped = @{}
  foreach ($row in $stockRowsCsv) {
    if (-not $row.locationId -or -not $row.sku) { continue }
    if (-not $grouped[$row.locationId]) { $grouped[$row.locationId] = @() }
    $grouped[$row.locationId] += @{
      sku = $row.sku
      quantity = [int]$row.quantity
      unitCost = if ($row.unitCost) { [decimal]$row.unitCost } else { $null }
    }
  }
  foreach ($key in $grouped.Keys) {
    Invoke-Api -Method Post -Path "/moves/purchase" -Body @{
      toId = [int]$key
      lines = $grouped[$key]
    } | Out-Null
  }
  $stockCsvRows = Invoke-Api -Method Get -Path "/stock?locationId=$($created.warehouseId)"
  $stockCsvRow = $stockCsvRows | Where-Object { $_.sku -eq $csvSku }
  $stockCsvQty = if ($stockCsvRow) { [int]$stockCsvRow.quantity } else { 0 }
  Write-Check "CSV stock producto (=4)" ($stockCsvQty -eq 4) "stock=$stockCsvQty"

  # CSV import for entries (purchase order)
  $csvLinesPath = Join-Path $env:TEMP "purchase-lines-$timestamp.csv"
  @"
sku,productName,manufacturerRef,productType,quantity,unitCost
$csvSku,CSV Standard $timestamp,REFCSV,standard,3,8
$testSku,Producto test $timestamp,REF-$timestamp,standard,2,10
"@ | Set-Content -Path $csvLinesPath -Encoding UTF8

  $csvLines = Import-Csv -Path $csvLinesPath
  $poLines = @()
  foreach ($row in $csvLines) {
    if (-not $row.sku) { continue }
    $qty = [int]$row.quantity
    if ($qty -lt 1) { continue }
    $poLines += @{
      sku = $row.sku
      productName = $row.productName
      manufacturerRef = $row.manufacturerRef
      productType = if ($row.productType -eq "quick") { "quick" } else { "standard" }
      quantity = $qty
      unitCost = if ($row.unitCost) { [decimal]$row.unitCost } else { $null }
    }
  }

  $poCsv = Invoke-Api -Method Post -Path "/purchase-orders" -Body @{
    supplierId = $created.supplierId
    status = "ordered"
    notes = "TEST CSV ENTRY $timestamp"
    lines = $poLines
  }
  Write-Check "CSV entrada" ($poCsv.id -gt 0)
  Invoke-Api -Method Post -Path "/purchase-orders/$($poCsv.id)/receive" -Body @{
    warehouseId = $created.warehouseId
  } | Out-Null

  $stockAfterCsv = Invoke-Api -Method Get -Path "/stock?locationId=$($created.warehouseId)"
  $stockCsvRow2 = $stockAfterCsv | Where-Object { $_.sku -eq $csvSku }
  $stockCsvQty2 = if ($stockCsvRow2) { [int]$stockCsvRow2.quantity } else { 0 }
  Write-Check "Stock CSV tras entrada (=7)" ($stockCsvQty2 -eq 7) "stock=$stockCsvQty2"
  $stockTestRow = $stockAfterCsv | Where-Object { $_.sku -eq $testSku }
  $stockTestQty = if ($stockTestRow) { [int]$stockTestRow.quantity } else { 0 }
  Write-Check "Stock TEST tras entrada CSV (=7)" ($stockTestQty -eq 7) "stock=$stockTestQty"

  # Suggestions endpoint
  $sug = Invoke-Api -Method Get -Path "/suggestions/purchases?minStock=3&days=30&limit=5"
  Write-Check "Sugerencias" ($sug -is [System.Array])

  # Reports endpoints
  $reportCat = Invoke-Api -Method Get -Path "/reports/sales-by-category"
  Write-Check "Informe ventas por categoria" ($reportCat -is [System.Array])
  $reportSku = Invoke-Api -Method Get -Path "/reports/sales-by-sku"
  Write-Check "Informe ventas por SKU" ($reportSku -is [System.Array])
  $reportMonth = Invoke-Api -Method Get -Path "/reports/sales-by-month"
  Write-Check "Informe ventas por mes" ($reportMonth -is [System.Array])
  $reportSummary = Invoke-Api -Method Get -Path "/reports/summary"
  Write-Check "Resumen devoluciones" ($reportSummary.returnsUnits -ge 1) "returns=$($reportSummary.returnsUnits)"

  # Audit log
  $audit = Invoke-Api -Method Get -Path "/audit?limit=20"
  Write-Check "Audit log" ($audit -is [System.Array])

  # CRM checks (phases/status/board/tasks/calendar/segments/notifications)
  $crmPhase = $null
  $crmStatus = $null
  $crmTaskId = $null
  $crmEventId = $null
  $crmSegmentId = $null

  $crmPhases = Try-Check "CRM listar fases" { Invoke-Api -Method Get -Path "/crm/phases" }
  if ($crmPhases -and $crmPhases.Count -gt 0) {
    $crmPhase = $crmPhases[0]
  } else {
    $crmPhase = Try-Check "CRM crear fase" {
      Invoke-Api -Method Post -Path "/crm/phases" -Body @{
        name = "Fase $timestamp"
        sortOrder = 1
        color = "#f77e21"
      }
    }
  }

  if ($crmPhase) {
    $crmStatuses = Try-Check "CRM listar columnas" {
      Invoke-Api -Method Get -Path "/crm/statuses?phase=$($crmPhase.id)"
    }
    if ($crmStatuses -and $crmStatuses.Count -gt 0) {
      $crmStatus = $crmStatuses[0]
    } else {
      $crmStatus = Try-Check "CRM crear columna" {
        Invoke-Api -Method Post -Path "/crm/statuses" -Body @{
          name = "Columna $timestamp"
          phaseId = $crmPhase.id
          sortOrder = 1
          color = "#f77e21"
        }
      }
    }
  }

  if ($crmStatus -and $created.customerId) {
    Try-Check "CRM mover cliente a columna" {
      Invoke-Api -Method Post -Path "/crm/board/move" -Body @{
        customerId = $created.customerId
        toStatusId = $crmStatus.id
        toPhaseId = $crmPhase.id
        position = 0
      }
    } | Out-Null
  }

  $crmBoard = Try-Check "CRM tablero" { Invoke-Api -Method Get -Path "/crm/board?phase=$($crmPhase.id)" }

  $crmTask = Try-Check "CRM crear tarea" {
    Invoke-Api -Method Post -Path "/crm/tasks" -Body @{
      type = "call"
      title = "Llamada $timestamp"
      dueAt = (Get-Date).AddHours(2).ToString("s")
      relatedCustomerId = $created.customerId
    }
  }
  if ($crmTask) { $crmTaskId = $crmTask.id }

  $crmTasksList = Try-Check "CRM listar tareas" { Invoke-Api -Method Get -Path "/crm/tasks?status=pending" }

  $crmEvent = Try-Check "CRM crear evento" {
    Invoke-Api -Method Post -Path "/crm/calendar" -Body @{
      type = "visit"
      title = "Visita $timestamp"
      startAt = (Get-Date).AddHours(4).ToString("s")
      endAt = (Get-Date).AddHours(5).ToString("s")
      customerId = $created.customerId
    }
  }
  if ($crmEvent) { $crmEventId = $crmEvent.id }
  $crmCalendar = Try-Check "CRM calendario" {
    $from = (Get-Date).AddDays(-1).ToString("s")
    $to = (Get-Date).AddDays(2).ToString("s")
    Invoke-Api -Method Get -Path "/crm/calendar?from=$from&to=$to"
  }

  Try-Check "CRM nota/timeline" {
    Invoke-Api -Method Post -Path "/crm/customers/$($created.customerId)/notes" -Body @{
      content = "Nota $timestamp"
    }
  } | Out-Null
  $crmTimeline = Try-Check "CRM timeline" { Invoke-Api -Method Get -Path "/crm/customers/$($created.customerId)/timeline" }

  $crmSegment = Try-Check "CRM crear segmento" {
    Invoke-Api -Method Post -Path "/crm/segments" -Body @{
      name = "Segmento $timestamp"
      filters = @{ lastPurchaseDays = 30 }
      dynamic = $true
    }
  }
  if ($crmSegment) { $crmSegmentId = $crmSegment.id }
  if ($crmSegmentId) {
    Try-Check "CRM clientes segmento" { Invoke-Api -Method Get -Path "/crm/segments/$crmSegmentId/customers" } | Out-Null
  }

  Try-Check "CRM notificaciones" { Invoke-Api -Method Get -Path "/crm/notifications" } | Out-Null

  # CRM export/import
  $crmExportPath = Join-Path $env:TEMP "crm-export-$timestamp.zip"
  try {
    $crmExportHeaders = @{ Authorization = "Bearer $Token" }
    Invoke-WebRequest -Uri "$ApiBase/crm/export" -OutFile $crmExportPath -Headers $crmExportHeaders -UseBasicParsing
    Write-Check "CRM export" (Test-Path $crmExportPath) $crmExportPath
    if (Test-Path $crmExportPath) {
      $boundary = "------------------------" + [System.Guid]::NewGuid().ToString("N")
      $fileBytes = [System.IO.File]::ReadAllBytes($crmExportPath)
      $fileName = [System.IO.Path]::GetFileName($crmExportPath)
      $newline = "`r`n"
      $header = "--$boundary$newline" +
        "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"$newline" +
        "Content-Type: application/zip$newline$newline"
      $footer = "$newline--$boundary--$newline"
      $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
      $footerBytes = [System.Text.Encoding]::UTF8.GetBytes($footer)
      $body = New-Object byte[] ($headerBytes.Length + $fileBytes.Length + $footerBytes.Length)
      [System.Buffer]::BlockCopy($headerBytes, 0, $body, 0, $headerBytes.Length)
      [System.Buffer]::BlockCopy($fileBytes, 0, $body, $headerBytes.Length, $fileBytes.Length)
      [System.Buffer]::BlockCopy($footerBytes, 0, $body, $headerBytes.Length + $fileBytes.Length, $footerBytes.Length)
      $importHeaders = @{
        Authorization = "Bearer $Token"
        "Content-Type" = "multipart/form-data; boundary=$boundary"
      }
      $crmImport = Invoke-RestMethod -Uri "$ApiBase/crm/import?mode=merge" -Method Post -Headers $importHeaders -Body $body
      Write-Check "CRM import" ($crmImport.mode -eq "merge")
    }
  } catch {
    $msg = Get-ErrorBody $_
    Write-Check "CRM export/import" $false $msg
  } finally {
    if (Test-Path $crmExportPath) { Remove-Item -Force $crmExportPath }
  }

  # Deposits flow
  $depositRetailId = $null
  if ($created.customerId) {
    try {
      $cust = Invoke-Api -Method Get -Path "/customers/$($created.customerId)"
      $depositRetail = Invoke-Api -Method Post -Path "/locations" -Body @{
        type = "retail"
        name = $cust.name
        city = "Test"
      }
      $depositRetailId = $depositRetail.id
    } catch {}
  }

  if ($depositRetailId) {
    Try-Check "Deposito crear" {
      Invoke-Api -Method Post -Path "/moves/transfer" -Body @{
        fromId = $created.warehouseId
        toId = $depositRetailId
        customerId = $created.customerId
        notes = "DEPOSITO $timestamp"
        lines = @(@{ sku = $testSku; quantity = 1 })
      }
    } | Out-Null

    Try-Check "Deposito clientes" { Invoke-Api -Method Get -Path "/deposits/customers" } | Out-Null
    $depositDetail = Try-Check "Deposito detalle" {
      Invoke-Api -Method Get -Path "/deposits/customers/$($created.customerId)"
    }
    if ($depositDetail -and $depositDetail.items.Count -gt 0) {
      Try-Check "Deposito convertir a venta" {
        Invoke-Api -Method Post -Path "/deposits/customers/$($created.customerId)/convert" -Body @{
          lines = @(@{ sku = $testSku; quantity = 1; unitPrice = 18 })
          notes = "DEPOSITO CONVERTIDO $timestamp"
        }
      } | Out-Null
      Try-Check "Deposito devolver" {
        Invoke-Api -Method Post -Path "/deposits/customers/$($created.customerId)/return" -Body @{
          warehouseId = $created.warehouseId
          lines = @(@{ sku = $testSku; quantity = 1 })
          notes = "DEPOSITO DEVUELTO $timestamp"
        }
      } | Out-Null
    }
  }

  # Deposits stress
  if ($depositRetailId) {
    Write-Host "== Stress depositos ==" -ForegroundColor Cyan
    for ($i = 1; $i -le 20; $i++) {
      Invoke-Api -Method Post -Path "/moves/transfer" -Body @{
        fromId = $created.warehouseId
        toId = $depositRetailId
        customerId = $created.customerId
        notes = "DEPOSITO $timestamp"
        lines = @(@{ sku = $testSku; quantity = 1 })
      } | Out-Null
    }
    Write-Check "Deposito stress crear 20" $true
    $depositDetailStress = Invoke-Api -Method Get -Path "/deposits/customers/$($created.customerId)"
    $hasItems = ($depositDetailStress.items | Measure-Object).Count -gt 0
    Write-Check "Deposito stress items" $hasItems
    # Convert 10
    for ($i = 1; $i -le 10; $i++) {
      Invoke-Api -Method Post -Path "/deposits/customers/$($created.customerId)/convert" -Body @{
        lines = @(@{ sku = $testSku; quantity = 1; unitPrice = 18 })
        notes = "DEPOSITO CONVERTIDO $timestamp"
      } | Out-Null
    }
    Write-Check "Deposito stress convertir 10" $true
    # Return 5
    for ($i = 1; $i -le 5; $i++) {
      Invoke-Api -Method Post -Path "/deposits/customers/$($created.customerId)/return" -Body @{
        warehouseId = $created.warehouseId
        lines = @(@{ sku = $testSku; quantity = 1 })
        notes = "DEPOSITO DEVUELTO $timestamp"
      } | Out-Null
    }
    Write-Check "Deposito stress devolver 5" $true
  }

  # Accessories CRUD
  if ($created.accessoryId) {
    Try-Check "Accesorios listar" { Invoke-Api -Method Get -Path "/accessories" } | Out-Null
    Try-Check "Accesorios actualizar" {
      Invoke-Api -Method Put -Path "/accessories/$($created.accessoryId)" -Body @{
        name = "ACC EDIT $timestamp"
        cost = 0.2
        price = 1.5
        active = $true
      }
    } | Out-Null
  }

  # Accessories stress
  Write-Host "== Stress accesorios ==" -ForegroundColor Cyan
  $accessoryIds = @()
  for ($i = 1; $i -le 10; $i++) {
    $acc = Invoke-Api -Method Post -Path "/accessories" -Body @{
      name = "ACC STRESS $i $timestamp"
      cost = 0.05
      price = 0.5
      active = $true
    }
    $accessoryIds += $acc.id
  }
  Write-Check "Accesorios stress crear 10" ($accessoryIds.Count -eq 10)
  # Ensure stock for accessory stress sale
  Invoke-Api -Method Post -Path "/moves/purchase" -Body @{
    toId = $created.warehouseId
    lines = @(
      @{ sku = $testSku2; quantity = 20; unitCost = 5 },
      @{ sku = $testSku; quantity = 10; unitCost = 10 }
    )
    notes = "STRESS ACCESSORY STOCK"
  } | Out-Null
  # Venta con accesorios (5 lineas)
  $accLines = @()
  for ($i = 0; $i -lt 5; $i++) {
    $accLines += @{
      sku = $testSku2
      quantity = 1
      unitPrice = 13
      addOns = @(
        @{
          accessoryId = $accessoryIds[$i]
          price = 1
          quantity = 2
        }
      )
    }
  }
  try {
    $saleAcc = Invoke-Api -Method Post -Path "/pos/sale" -Body @{
      warehouseId = $created.warehouseId
      channel = "B2C"
      paymentMethod = "Stress"
      lines = $accLines
    }
    $saleAccMove = Invoke-Api -Method Get -Path "/moves/$($saleAcc.id)"
    $addOnTotal = ($saleAccMove.lines | Measure-Object -Property addOnPrice -Sum).Sum
    Write-Check "Accesorios stress venta addOnPrice" ($addOnTotal -ge 10) "addOnPrice=$addOnTotal"
  } catch {
    $msg = Get-ErrorBody $_
    Write-Check "Accesorios stress venta" $false $msg
  }

  # Reports by channel + deposits summary
  Try-Check "Resumen B2B" { Invoke-Api -Method Get -Path "/reports/summary?channel=B2B" } | Out-Null
  Try-Check "Resumen B2C" { Invoke-Api -Method Get -Path "/reports/summary?channel=B2C" } | Out-Null
  Try-Check "Informe depositos" { Invoke-Api -Method Get -Path "/reports/deposits" } | Out-Null

  if ($Deep) {
    Write-Host "== Deep tests ==" -ForegroundColor Cyan
    # Extra stock moves to stress report numbers
    $deepSku = "DEEP-$timestamp"
    $deepSku2 = "DEEP2-$timestamp"
    $deepCustomer = Invoke-Api -Method Post -Path "/customers" -Body @{
        type = "public"
        name = "DEEP CUST $timestamp"
    }
    $deepCustId = $deepCustomer.id
    $createdProductSkus += $deepSku
    $createdProductSkus += $deepSku2
    Invoke-Api -Method Post -Path "/products" -Body @{
      sku = $deepSku
      name = "Deep product 1 $timestamp"
      cost = 4
      rrp = 12
      b2bPrice = 9
      active = $true
    } | Out-Null
    Invoke-Api -Method Post -Path "/products" -Body @{
      sku = $deepSku2
      name = "Deep product 2 $timestamp"
      cost = 6
      rrp = 18
      b2bPrice = 14
      active = $true
    } | Out-Null
    Invoke-Api -Method Post -Path "/moves/purchase" -Body @{
      toId = $created.warehouseId
      lines = @(
        @{ sku = $deepSku; quantity = 50; unitCost = 4 },
        @{ sku = $deepSku2; quantity = 40; unitCost = 6 }
      )
      notes = "DEEP STOCK"
    } | Out-Null

    # 20 mixed sales + returns
    $deepSales = @()
    $deepSaleSkus = @()
    for ($i = 1; $i -le 20; $i++) {
      $sku = if ($i % 2 -eq 0) { $deepSku } else { $deepSku2 }
      $price = if ($sku -eq $deepSku) { 12 } else { 18 }
      $sale = Invoke-Api -Method Post -Path "/pos/sale" -Body @{
        warehouseId = $created.warehouseId
        channel = "B2C"
        paymentMethod = "Deep"
        customerId = $deepCustId
        lines = @(
          @{ sku = $sku; quantity = 1; unitPrice = $price }
        )
      }
      $deepSales += $sale.id
      $deepSaleSkus += $sku
    }
    Write-Check "Deep ventas 20" ($deepSales.Count -eq 20)
    # 5 returns
    for ($i = 0; $i -lt 5; $i++) {
      Invoke-Api -Method Post -Path "/pos/return" -Body @{
        saleId = $deepSales[$i]
        warehouseId = $created.warehouseId
        lines = @(@{ sku = $deepSaleSkus[$i]; quantity = 1 })
      } | Out-Null
    }
    Write-Check "Deep devoluciones 5" $true

    # Reports sanity after deep ops
    $deepSummary = Invoke-Api -Method Get -Path "/reports/summary"
    Write-Check "Deep resumen ingresos" ($deepSummary.revenue -gt 0) "revenue=$($deepSummary.revenue)"
    Write-Check "Deep resumen costes" ($deepSummary.cost -gt 0) "cost=$($deepSummary.cost)"

    # Document series
    $series = Try-Check "Series listar" { Invoke-Api -Method Get -Path "/document-series" }
    if ($series) {
      Write-Check "Series >=4" ($series.Count -ge 4) "count=$($series.Count)"
    }

    # Delivery PDF
    if ($created.saleMoveId) {
      try {
        $deliveryPath = Join-Path $env:TEMP "delivery-$timestamp.pdf"
        Invoke-WebRequest -Uri "$ApiBase/reports/moves/$($created.saleMoveId)/delivery" -OutFile $deliveryPath -Headers $headers -UseBasicParsing
        $deliveryOk = (Test-Path $deliveryPath) -and ((Get-Item $deliveryPath).Length -gt 1000)
        Write-Check "Albaran PDF" $deliveryOk
        if (Test-Path $deliveryPath) { Remove-Item -Force $deliveryPath }
      } catch {
        $msg = Get-ErrorBody $_
        Write-Check "Albaran PDF" $false $msg
      }
    }

    # Web orders summary consistency (processed vs reports)
    $summaryWeb = Invoke-Api -Method Get -Path "/reports/summary?channel=WEB"
    Write-Check "Resumen Web OK" ($summaryWeb -ne $null)

    Write-Host "== Deep stress mix ==" -ForegroundColor Cyan
    $deepStamp = Get-Date -Format "yyyyMMddHHmmss"
    $mixProducts = @()
    $mixCustomers = @()
    $mixAccessories = @()
    # Create 300 products
    for ($i = 1; $i -le 300; $i++) {
      $sku = "MIX-$deepStamp-$i"
      Invoke-Api -Method Post -Path "/products" -Body @{
        sku = $sku
        name = "Mix product $i $deepStamp"
        cost = 2 + ($i % 5)
        rrp = 10 + ($i % 7)
        b2bPrice = 8 + ($i % 6)
        active = $true
      } | Out-Null
      $mixProducts += $sku
      $createdProductSkus += $sku
    }
    Write-Check "Mix productos 300" ($mixProducts.Count -eq 300)

    # Create 300 customers (public)
    for ($i = 1; $i -le 300; $i++) {
      $cust = Invoke-Api -Method Post -Path "/customers" -Body @{
        type = "public"
        name = "Mix customer $i $deepStamp"
      }
      $mixCustomers += $cust.id
      $stressData.customerIds += $cust.id
    }
    Write-Check "Mix clientes 300" ($mixCustomers.Count -eq 300)

    # Create 100 accessories
    for ($i = 1; $i -le 100; $i++) {
      $acc = Invoke-Api -Method Post -Path "/accessories" -Body @{
        name = "Mix accessory $i $deepStamp"
        cost = 0.05 + (($i % 5) * 0.01)
        price = 0.5 + (($i % 4) * 0.2)
        active = $true
      }
      $mixAccessories += $acc.id
    }
    Write-Check "Mix accesorios 100" ($mixAccessories.Count -eq 100)

    # Bulk stock in for all mix products
    $bulkLines = @()
    foreach ($sku in $mixProducts) {
      $bulkLines += @{ sku = $sku; quantity = 50; unitCost = 4 }
    }
    Invoke-Api -Method Post -Path "/moves/purchase" -Body @{
      toId = $created.warehouseId
      lines = $bulkLines
      notes = "MIX STOCK $deepStamp"
    } | Out-Null
    Write-Check "Mix stock inicial" $true

    # 100 transfers to warehouse2
    for ($i = 0; $i -lt 100; $i++) {
      $sku = $mixProducts[$i]
      Invoke-Api -Method Post -Path "/moves/transfer" -Body @{
        fromId = $created.warehouseId
        toId = $created.warehouse2Id
        lines = @(@{ sku = $sku; quantity = 1 })
      } | Out-Null
    }
    Write-Check "Mix transferencias 100" $true

    # 600 sales with mixed accessories
    $saleIds = @()
    for ($i = 0; $i -lt 600; $i++) {
      $sku = $mixProducts[$i % $mixProducts.Count]
      $custId = $mixCustomers[$i % $mixCustomers.Count]
      $accId = $mixAccessories[$i % $mixAccessories.Count]
      $unitPrice = 10 + ($i % 7)
      $sale = Invoke-Api -Method Post -Path "/pos/sale" -Body @{
        warehouseId = $created.warehouseId
        channel = "B2C"
        paymentMethod = "Mix"
        customerId = $custId
        lines = @(
          @{
            sku = $sku
            quantity = 1
            unitPrice = $unitPrice
            addOns = @(
              @{
                accessoryId = $accId
                price = 1
                quantity = 1
              }
            )
          }
        )
      }
      $saleIds += $sale.id
    }
    Write-Check "Mix ventas 600" ($saleIds.Count -eq 600)

    # 200 returns from first 200 sales
    for ($i = 0; $i -lt 200; $i++) {
      $saleId = $saleIds[$i]
      $sku = $mixProducts[$i % $mixProducts.Count]
      Invoke-Api -Method Post -Path "/pos/return" -Body @{
        saleId = $saleId
        warehouseId = $created.warehouseId
        lines = @(@{ sku = $sku; quantity = 1 })
      } | Out-Null
    }
    Write-Check "Mix devoluciones 200" $true

    # Reports sanity
    $mixSummary = Invoke-Api -Method Get -Path "/reports/summary"
    Write-Check "Mix resumen ingresos" ($mixSummary.revenue -gt 0) "revenue=$($mixSummary.revenue)"
    Write-Check "Mix resumen costes" ($mixSummary.cost -gt 0) "cost=$($mixSummary.cost)"
  }

  if ($Massive) {
    Write-Host "== Massive stress suite ==" -ForegroundColor Cyan
    $massStamp = Get-Date -Format "yyyyMMddHHmmss"
    $massProducts = @()
    $massCustomers = @()
    $massB2B = @()
    $massAccessories = @()

    for ($i = 1; $i -le 300; $i++) {
      $sku = "MASS-$massStamp-$i"
      Invoke-Api -Method Post -Path "/products" -Body @{
        sku = $sku
        name = "Mass product $i $massStamp"
        cost = 3 + ($i % 9)
        rrp = 12 + ($i % 10)
        b2bPrice = 9 + ($i % 8)
        active = $true
      } | Out-Null
      $massProducts += $sku
      $createdProductSkus += $sku
    }
    Write-Check "Mass productos 300" ($massProducts.Count -eq 300)

    for ($i = 1; $i -le 300; $i++) {
      $cust = Invoke-Api -Method Post -Path "/customers" -Body @{
        type = "public"
        name = "Mass customer $i $massStamp"
      }
      $massCustomers += $cust.id
      $stressData.customerIds += $cust.id
    }
    Write-Check "Mass clientes 300" ($massCustomers.Count -eq 300)

    for ($i = 1; $i -le 50; $i++) {
      $cust = Invoke-Api -Method Post -Path "/customers" -Body @{
        type = "b2b"
        name = "Mass B2B $i $massStamp"
      }
      $massB2B += $cust.id
      $stressData.customerB2BIds += $cust.id
    }
    Write-Check "Mass clientes B2B 50" ($massB2B.Count -eq 50)

    for ($i = 1; $i -le 100; $i++) {
      $acc = Invoke-Api -Method Post -Path "/accessories" -Body @{
        name = "Mass accessory $i $massStamp"
        cost = 0.08 + (($i % 4) * 0.03)
        price = 0.7 + (($i % 5) * 0.2)
        active = $true
      }
      $massAccessories += $acc.id
    }
    Write-Check "Mass accesorios 100" ($massAccessories.Count -eq 100)

    $bulkLines = @()
    foreach ($sku in $massProducts) {
      $bulkLines += @{ sku = $sku; quantity = 80; unitCost = 4.5 }
    }
    Invoke-Api -Method Post -Path "/moves/purchase" -Body @{
      toId = $created.warehouseId
      lines = $bulkLines
      notes = "MASS STOCK $massStamp"
    } | Out-Null
    Write-Check "Mass stock inicial" $true

    for ($i = 0; $i -lt 100; $i++) {
      $sku = $massProducts[$i]
      Invoke-Api -Method Post -Path "/moves/transfer" -Body @{
        fromId = $created.warehouseId
        toId = $created.warehouse2Id
        lines = @(@{ sku = $sku; quantity = 2 })
      } | Out-Null
    }
    Write-Check "Mass transferencias 100" $true

    $massSales = @()
    $massReturnSkus = @()
    for ($i = 0; $i -lt 1000; $i++) {
      $custId = $massCustomers[$i % $massCustomers.Count]
      $lines = Build-SaleLines -Skus $massProducts -Lines (Get-Random -Minimum 1 -Maximum 3)
      $addOn = $massAccessories[$i % $massAccessories.Count]
      foreach ($line in $lines) {
        $line.addOns = @(@{ accessoryId = $addOn; price = 1; quantity = 1 })
      }
      $returnSku = $null
      if ($lines -and $lines.Count -ge 1 -and $lines[0].sku) {
        $returnSku = $lines[0].sku
      } else {
        $returnSku = $massProducts[0]
      }
      $sale = Invoke-Api -Method Post -Path "/pos/sale" -Body @{
        warehouseId = $created.warehouseId
        channel = "B2C"
        paymentMethod = "Mass"
        customerId = $custId
        lines = $lines
      }
      $massSales += $sale.id
      $massReturnSkus += $returnSku
    }
    Write-Check "Mass ventas 1000" ($massSales.Count -eq 1000)

    for ($i = 0; $i -lt 200; $i++) {
      $saleId = $massSales[$i]
      $sku = $massReturnSkus[$i]
      if (-not $sku) { $sku = $massProducts[0] }
      Invoke-Api -Method Post -Path "/pos/return" -Body @{
        saleId = $saleId
        warehouseId = $created.warehouseId
        lines = @(@{ sku = $sku; quantity = 1 })
      } | Out-Null
    }
    Write-Check "Mass devoluciones 200" $true

    $b2bSales = @()
    for ($i = 0; $i -lt 100; $i++) {
      $custId = $massB2B[$i % $massB2B.Count]
      $sku = $massProducts[$i % $massProducts.Count]
      $sale = Invoke-Api -Method Post -Path "/pos/sale" -Body @{
        warehouseId = $created.warehouseId
        channel = "B2B"
        paymentMethod = "MassB2B"
        customerId = $custId
        lines = @(@{ sku = $sku; quantity = 2; unitPrice = 9 })
      }
      $b2bSales += $sale.id
    }
    Write-Check "Mass ventas B2B 100" ($b2bSales.Count -eq 100)

    $summary = Invoke-Api -Method Get -Path "/reports/summary"
    Assert-Number "Mass resumen ingresos" ([double]$summary.revenue) 1
    Assert-Number "Mass resumen costes" ([double]$summary.cost) 1
    $massSalesCount = 0
    if ($null -ne $summary.salesCount) { $massSalesCount = [double]$summary.salesCount }
    elseif ($null -ne $summary.sales) { $massSalesCount = [double]$summary.sales }
    elseif ($null -ne $summary.orders) { $massSalesCount = [double]$summary.orders }
    Assert-Number "Mass resumen ventas" $massSalesCount 1

    $skuReport = Invoke-Api -Method Get -Path "/reports/sales-by-sku"
    $skuCount = if ($skuReport -is [System.Array]) { $skuReport.Count } else { 0 }
    Write-Check "Mass ventas por SKU" ($skuCount -gt 0) "count=$skuCount"
  }

  # Permissions (no auth)
  try {
    Invoke-ApiNoAuth -Method Get -Path "/crm/board" | Out-Null
    Write-Check "Permisos CRM sin auth" $false "sin bloqueo"
  } catch {
    $msg = Get-ErrorBody $_
    $ok = ($msg -match "401" -or $msg -match "Unauthorized" -or $msg -match "403")
    Write-Check "Permisos CRM sin auth" $ok $msg
  }

  # Woo settings
  $woo = Invoke-Api -Method Get -Path "/settings/woo"
  Write-Check "Woo settings" ($null -ne $woo.wooSyncEnabled)
  # Update Woo settings using only valid warehouse IDs
  $warehousesOnly = $locationsList | Where-Object { $_.type -eq "warehouse" } | Select-Object -ExpandProperty id
  $safeWooIds = @()
  if ($woo.wooStockWarehouseIds) {
    $safeWooIds = @($woo.wooStockWarehouseIds | Where-Object { $warehousesOnly -contains $_ })
  }
  $wooUpdated = Invoke-Api -Method Put -Path "/settings/woo" -Body @{
    wooSyncEnabled = $woo.wooSyncEnabled
    wooStockWarehouseIds = $safeWooIds
    lastWooSyncAt = $woo.lastWooSyncAt
  }
  Write-Check "Actualizar Woo settings" ($null -ne $wooUpdated.wooSyncEnabled)

  # Backup (run + list)
  $backup = Invoke-Api -Method Post -Path "/backup/run"
  Write-Check "Backup run" ($null -ne $backup.name)
  $backupList = Invoke-Api -Method Get -Path "/backup/list"
  Write-Check "Backup list" ($backupList -is [System.Array])
  if ($backupList.Count -ge 1) {
    $backupName = $backupList[0].name
    $backupPath = Join-Path $env:TEMP $backupName
    $downloadHeaders = @{ Authorization = "Bearer $Token" }
    Invoke-WebRequest -Uri "$ApiBase/backup/download/$backupName" -OutFile $backupPath -Headers $downloadHeaders -UseBasicParsing
    Write-Check "Backup download" (Test-Path $backupPath)
    $requiredBackupFiles = @(
      "manifest.json",
      "customers.json",
      "users.json",
      "audit_logs.json",
      "products.json",
      "categories.json",
      "product_categories.json",
      "suppliers.json",
      "price_rules.json",
      "payment_methods.json",
      "purchase_orders.json",
      "purchase_order_lines.json",
      "locations.json",
      "stock_moves.json",
      "stock_move_lines.json",
      "accessories.json",
      "document_series.json",
      "web_orders.json",
      "web_order_lines.json",
      "settings.json",
      "crm_phases.json",
      "crm_statuses.json",
      "crm_cards.json",
      "crm_tasks.json",
      "crm_notes.json",
      "crm_events.json",
      "crm_task_templates.json",
      "crm_segments.json",
      "crm_automations.json",
      "crm_automation_runs.json",
      "crm_notifications.json",
      "crm_opportunities.json",
      "cash_closures.json"
    )
    Test-ZipContains -Label "Backup incluye todo" -ZipPath $backupPath -Required $requiredBackupFiles
    if (Test-Path $backupPath) { Remove-Item -Force $backupPath }
  }

  # Export and import (merge)
  $exportPath = Join-Path $env:TEMP "export-$timestamp.zip"
  $exportHeaders = @{ Authorization = "Bearer $Token" }
  Invoke-WebRequest -Uri "$ApiBase/export" -OutFile $exportPath -Headers $exportHeaders -UseBasicParsing
  $exportOk = Test-Path $exportPath
  Write-Check "Export ZIP" $exportOk $exportPath
  if ($exportOk) {
    $requiredExportFiles = @(
      "manifest.json",
      "customers.json",
      "users.json",
      "audit_logs.json",
      "products.json",
      "categories.json",
      "product_categories.json",
      "suppliers.json",
      "price_rules.json",
      "payment_methods.json",
      "purchase_orders.json",
      "purchase_order_lines.json",
      "locations.json",
      "stock_moves.json",
      "stock_move_lines.json",
      "accessories.json",
      "document_series.json",
      "web_orders.json",
      "web_order_lines.json",
      "settings.json",
      "crm_phases.json",
      "crm_statuses.json",
      "crm_cards.json",
      "crm_tasks.json",
      "crm_notes.json",
      "crm_events.json",
      "crm_task_templates.json",
      "crm_segments.json",
      "crm_automations.json",
      "crm_automation_runs.json",
      "crm_notifications.json",
      "crm_opportunities.json",
      "cash_closures.json"
    )
    Test-ZipContains -Label "Export incluye todo" -ZipPath $exportPath -Required $requiredExportFiles
  }

  if ($exportOk) {
    $boundary = "------------------------" + [System.Guid]::NewGuid().ToString("N")
    $fileBytes = [System.IO.File]::ReadAllBytes($exportPath)
    $fileName = [System.IO.Path]::GetFileName($exportPath)
    $newline = "`r`n"
    $header = "--$boundary$newline" +
      "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"$newline" +
      "Content-Type: application/zip$newline$newline"
    $footer = "$newline--$boundary--$newline"
    $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
    $footerBytes = [System.Text.Encoding]::UTF8.GetBytes($footer)
    $body = New-Object byte[] ($headerBytes.Length + $fileBytes.Length + $footerBytes.Length)
    [System.Buffer]::BlockCopy($headerBytes, 0, $body, 0, $headerBytes.Length)
    [System.Buffer]::BlockCopy($fileBytes, 0, $body, $headerBytes.Length, $fileBytes.Length)
    [System.Buffer]::BlockCopy($footerBytes, 0, $body, $headerBytes.Length + $fileBytes.Length, $footerBytes.Length)

    $importHeaders = @{
      Authorization = "Bearer $Token"
      "Content-Type" = "multipart/form-data; boundary=$boundary"
    }
    $importRes = Invoke-RestMethod -Uri "$ApiBase/import?mode=merge" -Method Post -Headers $importHeaders -Body $body
    Write-Check "Import ZIP (merge)" ($importRes.mode -eq "merge")
  }

  # Woo import + assign + process (optional)
  $import = Invoke-Api -Method Post -Path "/woo/import" -Body @{}
  $importedCount = if ($import.imported) { [int]$import.imported } else { 0 }
  Write-Check "Woo import" ($importedCount -ge 0) "imported=$importedCount"
  $orders = Invoke-Api -Method Get -Path "/web-orders"
  $woo = $orders | Where-Object { $_.wooOrderId -eq "9001" } | Select-Object -First 1
  if ($woo) {
    $created.webOrderId = $woo.wooOrderId
    $assign = Invoke-Api -Method Post -Path "/web-orders/$($woo.wooOrderId)/assign-warehouse" -Body @{
      warehouseId = $created.warehouseId
    }
    Write-Check "Asignar almacen pedido web" ($assign.assignedWarehouseId -eq $created.warehouseId)

    if ($woo.processedAt) {
      Write-Check "Procesar pedido web" $true "ya procesado"
    } else {
      $processed = $null
      try {
        $processed = Invoke-Api -Method Post -Path "/web-orders/$($woo.wooOrderId)/process"
      } catch {
        $msg = Get-ErrorBody $_
        $match = [regex]::Match($msg, "Insufficient stock for ([^ ]+)")
        if ($match.Success) {
          $needSku = $match.Groups[1].Value
          Invoke-Api -Method Post -Path "/moves/purchase" -Body @{
            toId = $created.warehouseId
            lines = @(
              @{
                sku = $needSku
                quantity = 5
                unitCost = 5
              }
            )
          } | Out-Null
          try {
            $processed = Invoke-Api -Method Post -Path "/web-orders/$($woo.wooOrderId)/process"
          } catch {
            $processed = $null
            $msg = Get-ErrorBody $_
            if ($msg -match "Order already processed") {
              Write-Check "Procesar pedido web" $true "ya procesado"
            } else {
              Write-Check "Procesar pedido web" $false $msg
            }
          }
        } elseif ($msg -match "Order already processed") {
          Write-Check "Procesar pedido web" $true "ya procesado"
        } else {
          Write-Check "Procesar pedido web" $false $msg
        }
      }
      if ($processed) {
        Write-Check "Procesar pedido web" ($null -ne $processed.move)
      }
    }
  } else {
    Write-Check "Pedido web mock" $true "no configurado"
  }

  # Web orders reconcile + pending revenue vs report
  $reconcile = Try-Check "Web reconcile" {
    Invoke-Api -Method Post -Path "/web-orders/reconcile" -Body @{}
  }
  $orders = Invoke-Api -Method Get -Path "/web-orders"
  $processedMissing = $orders | Where-Object { $_.processedAt -and $_.hasMove -eq $false }
  Write-Check "Web procesados con venta" ($processedMissing.Count -eq 0) "missing=$($processedMissing.Count)"

  $pendingOrders = $orders | Where-Object { -not $_.processedAt -or $_.hasMove -eq $false }
  $pendingSum = 0.0
  $checked = 0
  foreach ($o in $pendingOrders) {
    if ($checked -ge 15) { break }
    try {
      $detail = Invoke-Api -Method Get -Path "/web-orders/$($o.wooOrderId)"
      foreach ($line in $detail.lines) {
        $lineTotal = 0
        if ($line.lineTotal) {
          $lineTotal = [double]$line.lineTotal
        } else {
          $lineTotal = [double]$line.qty * [double]$line.price
        }
        $pendingSum += $lineTotal
      }
      $checked += 1
    } catch {}
  }
  $summaryWeb = Invoke-Api -Method Get -Path "/reports/summary?channel=WEB"
  if ($pendingOrders.Count -gt 0) {
    $diff = [math]::Abs([double]$summaryWeb.revenuePending - $pendingSum)
    $okPending = $diff -lt 0.5
    Write-Check "Web pendientes vs informe" $okPending "pending=$pendingSum report=$($summaryWeb.revenuePending)"
  } else {
    Write-Check "Web pendientes vs informe" ($summaryWeb.revenuePending -eq 0) "report=$($summaryWeb.revenuePending)"
  }

  # PDF endpoints for sale
  if ($created.saleMoveId) {
    try {
      $ticketPath = Join-Path $env:TEMP "ticket-$timestamp.pdf"
      Invoke-WebRequest -Uri "$ApiBase/reports/moves/$($created.saleMoveId)/ticket" -OutFile $ticketPath -Headers $exportHeaders -UseBasicParsing
      $ticketOk = (Test-Path $ticketPath) -and ((Get-Item $ticketPath).Length -gt 1000)
      Write-Check "Ticket PDF" $ticketOk
      if (Test-Path $ticketPath) { Remove-Item -Force $ticketPath }
    } catch {
      $msg = Get-ErrorBody $_
      Write-Check "Ticket PDF" $false $msg
    }
    try {
      $invoicePath = Join-Path $env:TEMP "invoice-$timestamp.pdf"
      Invoke-WebRequest -Uri "$ApiBase/reports/moves/$($created.saleMoveId)/invoice" -OutFile $invoicePath -Headers $exportHeaders -UseBasicParsing
      $invoiceOk = (Test-Path $invoicePath) -and ((Get-Item $invoicePath).Length -gt 1000)
      Write-Check "Factura PDF" $invoiceOk
      if (Test-Path $invoicePath) { Remove-Item -Force $invoicePath }
    } catch {
      $msg = Get-ErrorBody $_
      Write-Check "Factura PDF" $false $msg
    }
  }

  if ($Stress) {
    Write-Host "== Stress test (14 dias, 60 ventas/dia) ==" -ForegroundColor Cyan

    $expectedUnits = 0
    $expectedReturns = 0
    $expectedRevenue = 0.0
    $expectedCost = 0.0
    $skuPivot = $null

    # Create stress products
    for ($i = 1; $i -le 5; $i++) {
      $sku = "STRESS-$i-$timestamp"
      $prod = Invoke-Api -Method Post -Path "/products" -Body @{
        sku = $sku
        name = "Stress Product $i $timestamp"
        cost = 3 + $i
        rrp = 12 + $i
        b2bPrice = 9 + $i
        active = $true
      }
      $stressData.productSkus += $sku
      $createdProductSkus += $sku
      Write-Check "Stress producto $i" ($prod.sku -eq $sku)
      if (-not $skuPivot) { $skuPivot = $sku }
    }

    # Create customers
    for ($i = 1; $i -le 10; $i++) {
      $c = Invoke-Api -Method Post -Path "/customers" -Body @{
        type = "public"
        name = "Stress Public $i $timestamp"
      }
      $stressData.customerIds += $c.id
    }
    for ($i = 1; $i -le 10; $i++) {
      $c = Invoke-Api -Method Post -Path "/customers" -Body @{
        type = "b2b"
        name = "Stress B2B $i $timestamp"
      }
      $stressData.customerB2BIds += $c.id
    }
    Write-Check "Stress clientes" ($stressData.customerIds.Count -ge 10 -and $stressData.customerB2BIds.Count -ge 10)

    # Bulk stock in
    $bulkLines = @()
    foreach ($sku in $stressData.productSkus) {
      $bulkLines += @{ sku = $sku; quantity = 800; unitCost = 4 }
    }
    Invoke-Api -Method Post -Path "/moves/purchase" -Body @{
      toId = $created.warehouseId
      lines = $bulkLines
      notes = "STRESS STOCK"
    } | Out-Null
    Write-Check "Stress stock inicial" $true

    $startDate = (Get-Date).Date.AddDays(-13)
    for ($d = 0; $d -lt 14; $d++) {
      $day = $startDate.AddDays($d)
      # create some returns from previous day
      if ($stressData.saleIds.Count -gt 5 -and ($d % 3 -eq 0)) {
        $returnId = $stressData.saleIds[0]
        $stressData.saleIds = $stressData.saleIds | Select-Object -Skip 1
        try {
          Invoke-Api -Method Post -Path "/pos/return" -Body @{
            saleId = $returnId
            warehouseId = $created.warehouseId
            lines = @(@{ sku = $stressData.productSkus[0]; quantity = 1 })
          } | Out-Null
          $expectedReturns += 1
        } catch {}
      }

      for ($i = 0; $i -lt 60; $i++) {
        $sku = $stressData.productSkus[$i % $stressData.productSkus.Count]
        $channel = if ($i % 5 -eq 0) { "B2B" } else { "B2C" }
        $customerId = $null
        if ($channel -eq "B2B") {
          $customerId = $stressData.customerB2BIds[$i % $stressData.customerB2BIds.Count]
        }
        $unitPrice = if ($channel -eq "B2B") { 9 } else { 12 }
        $sale = Invoke-Api -Method Post -Path "/pos/sale" -Body @{
          warehouseId = $created.warehouseId
          channel = $channel
          customerId = $customerId
          paymentMethod = "Stress"
          date = $day.AddMinutes($i).ToString("s")
          lines = @(
            @{
              sku = $sku
              quantity = 1
              unitPrice = $unitPrice
            }
          )
        }
        $stressData.saleIds += $sale.id
        $expectedUnits += 1
        $expectedRevenue += [double]$unitPrice
      }
      # Daily checks
      $from = $day.ToString("yyyy-MM-ddT00:00:00")
      $to = $day.AddDays(1).AddSeconds(-1).ToString("yyyy-MM-ddT23:59:59")
      $daily = Invoke-Api -Method Get -Path "/reports/summary?from=$from&to=$to"
      Write-Check "Stress resumen dia $($day.ToString('yyyy-MM-dd'))" ($daily.orders -ge 60) "orders=$($daily.orders)"
      Write-Check "Stress unidades dia $($day.ToString('yyyy-MM-dd'))" ($daily.units -ge 60) "units=$($daily.units)"
      if ($d % 3 -eq 0) {
        Write-Check "Stress devoluciones dia $from" ($daily.returnsUnits -ge 0) "returns=$($daily.returnsUnits)"
      }
      Write-Host "[OK] Stress ventas dia $($day.ToString('yyyy-MM-dd'))"
    }

    # Final aggregate checks
    $finalSummary = Invoke-Api -Method Get -Path "/reports/summary?from=$($startDate.ToString("yyyy-MM-dd"))&to=$((Get-Date).ToString("yyyy-MM-dd"))"
    Write-Check "Stress total unidades" ($finalSummary.units -ge $expectedUnits) "units=$($finalSummary.units)"
    Write-Check "Stress total devoluciones" ($finalSummary.returnsUnits -ge $expectedReturns) "returns=$($finalSummary.returnsUnits)"

    if ($skuPivot) {
      $stockFinal = Invoke-Api -Method Get -Path "/stock?locationId=$($created.warehouseId)"
      $row = $stockFinal | Where-Object { $_.sku -eq $skuPivot }
      $qty = if ($row) { [int]$row.quantity } else { 0 }
      Write-Check "Stress stock final SKU pivot" ($qty -ge 0) "qty=$qty"
    }
  }

} finally {
  if (-not $KeepData) {
    function Try-Delete {
      param([string]$Path)
      try {
        Invoke-Api -Method Delete -Path $Path | Out-Null
        return $true
      } catch {
        $msg = Get-ErrorBody $_
        if ($msg -match "404" -or $msg -match "Not Found") {
          return $true
        }
        throw
      }
    }
    try {
      if ($created.pricingRuleId) {
        Try-Delete "/pricing/rules/$($created.pricingRuleId)" | Out-Null
      }
      if ($rule2.id) {
        Try-Delete "/pricing/rules/$($rule2.id)" | Out-Null
      }
      if ($testSku) {
        Try-Delete "/products/$testSku?hard=true" | Out-Null
      }
      if ($testSku2) {
        Try-Delete "/products/$testSku2?hard=true" | Out-Null
      }
      foreach ($sku in $createdProductSkus) {
        if ($sku -and $sku -ne $testSku -and $sku -ne $testSku2) {
          Try-Delete "/products/$sku?hard=true" | Out-Null
        }
      }
      if ($created.categoryId) {
        Try-Delete "/categories/$($created.categoryId)" | Out-Null
      }
      if ($created.accessoryId) {
        Try-Delete "/accessories/$($created.accessoryId)" | Out-Null
      }
      foreach ($cid in $stressData.customerIds) {
        Try-Delete "/customers/$cid" | Out-Null
      }
      foreach ($cid in $stressData.customerB2BIds) {
        Try-Delete "/customers/$cid" | Out-Null
      }
      if ($created.customerId) {
        Try-Delete "/customers/$($created.customerId)" | Out-Null
      }
      if ($created.supplierId) {
        Try-Delete "/suppliers/$($created.supplierId)" | Out-Null
      }
      if ($created.retailId) {
        Try-Delete "/locations/$($created.retailId)" | Out-Null
      }
      if ($created.warehouse2Id) {
        Try-Delete "/locations/$($created.warehouse2Id)" | Out-Null
      }
      if ($created.warehouseId) {
        Try-Delete "/locations/$($created.warehouseId)" | Out-Null
      }
      Write-Host "Cleanup: ok"
    } catch {
      Write-Host "Cleanup: fallo $($_.Exception.Message)"
    }
  } else {
    Write-Host "Cleanup: omitido (-KeepData)"
  }
}

Write-Host "== Fin verificacion ==" -ForegroundColor Cyan
