import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { SettingsModule } from "./settings/settings.module";
import { LocationsModule } from "./locations/locations.module";
import { ProductsModule } from "./products/products.module";
import { MovesModule } from "./moves/moves.module";
import { StockModule } from "./stock/stock.module";
import { WooImportModule } from "./woo-import/woo-import.module";
import { WebOrdersModule } from "./web-orders/web-orders.module";
import { AppScheduleModule } from "./schedule/schedule.module";
import { ExportImportModule } from "./export-import/export-import.module";
import { BackupModule } from "./backup/backup.module";
import { AuditModule } from "./audit/audit.module";
import { AuditInterceptor } from "./audit/audit.interceptor";
import { CategoriesModule } from "./categories/categories.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { CustomersModule } from "./customers/customers.module";
import { PosModule } from "./pos/pos.module";
import { PaymentMethodsModule } from "./payment-methods/payment-methods.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { PurchaseOrdersModule } from "./purchase-orders/purchase-orders.module";
import { ReportsModule } from "./reports/reports.module";
import { UsersModule } from "./users/users.module";
import { PricingModule } from "./pricing/pricing.module";
import { SuggestionsModule } from "./suggestions/suggestions.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    SettingsModule,
    LocationsModule,
    ProductsModule,
    MovesModule,
    StockModule,
    WooImportModule,
    WebOrdersModule,
    AppScheduleModule,
    ExportImportModule,
    BackupModule,
    AuditModule,
    CategoriesModule,
    DashboardModule,
    CustomersModule,
    PosModule,
    PaymentMethodsModule,
    SuppliersModule,
    PurchaseOrdersModule,
    ReportsModule,
    UsersModule,
    PricingModule,
    SuggestionsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
