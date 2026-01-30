import { IsOptional, IsString } from "class-validator";

export class UpdateFiscalSettingsDto {
  @IsOptional()
  @IsString()
  issuerName?: string;

  @IsOptional()
  @IsString()
  issuerTaxId?: string;

  @IsOptional()
  @IsString()
  issuerAddressLine1?: string;

  @IsOptional()
  @IsString()
  issuerAddressLine2?: string;

  @IsOptional()
  @IsString()
  issuerPostalCode?: string;

  @IsOptional()
  @IsString()
  issuerCity?: string;

  @IsOptional()
  @IsString()
  issuerProvince?: string;

  @IsOptional()
  @IsString()
  issuerCountry?: string;

  @IsOptional()
  @IsString()
  issuerEmail?: string;

  @IsOptional()
  @IsString()
  issuerPhone?: string;
}
