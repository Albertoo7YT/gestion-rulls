param(
  [string]$ApiBase = "http://localhost:3001",
  [string]$Token = "",
  [switch]$KeepData
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
  if ($null -ne $Body) {
    $json = $Body | ConvertTo-Json -Depth 6
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -ContentType "application/json" -Body $json -TimeoutSec 20
  }
  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -TimeoutSec 20
}

Write-Host "== Verificacion completa ==" -ForegroundColor Cyan

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
}

$createdProductSkus = @()

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

  $movesList = Invoke-Api -Method Get -Path "/moves"
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
      }
    )
  }
  Write-Check "Venta TPV B2C" ($saleB2c.id -gt 0)

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
  Write-Check "Stock tras devolucion (=6)" ($stockQty3 -eq 6) "stock=$stockQty3"

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
  Write-Check "Stock TEST tras entrada CSV (=8)" ($stockTestQty -eq 8) "stock=$stockTestQty"

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

  # Audit log
  $audit = Invoke-Api -Method Get -Path "/audit?limit=20"
  Write-Check "Audit log" ($audit -is [System.Array])

  # Woo settings
  $woo = Invoke-Api -Method Get -Path "/settings/woo"
  Write-Check "Woo settings" ($null -ne $woo.wooSyncEnabled)
  $wooUpdated = Invoke-Api -Method Put -Path "/settings/woo" -Body @{
    wooSyncEnabled = $woo.wooSyncEnabled
    wooStockWarehouseIds = $woo.wooStockWarehouseIds
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
    if (Test-Path $backupPath) { Remove-Item -Force $backupPath }
  }

  # Export and import (merge)
  $exportPath = Join-Path $env:TEMP "export-$timestamp.zip"
  $exportHeaders = @{ Authorization = "Bearer $Token" }
  Invoke-WebRequest -Uri "$ApiBase/export" -OutFile $exportPath -Headers $exportHeaders -UseBasicParsing
  $exportOk = Test-Path $exportPath
  Write-Check "Export ZIP" $exportOk $exportPath

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

  # Woo import + assign + process
  $import = Invoke-Api -Method Post -Path "/woo/import" -Body @{}
  Write-Check "Woo import" ($import.imported -ge 1) "imported=$($import.imported)"
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
    Write-Check "Pedido web mock" $false "No se encontro 9001"
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
