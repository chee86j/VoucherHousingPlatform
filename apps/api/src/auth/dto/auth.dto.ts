/**
 * Auth DTOs - Request validation
 */

import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class MfaVerifyDto {
  @IsString()
  mfaToken: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^\d{6}$/, { message: 'TOTP code must be 6 digits' })
  totpCode: string;
}

export class MfaEnrollDto {
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^\d{6}$/, { message: 'TOTP code must be 6 digits' })
  totpCode: string;
}

export class MfaBootstrapDto {
  @IsString()
  mfaToken: string;
}

export class MfaBootstrapConfirmDto extends MfaBootstrapDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'TOTP code must be 6 digits' })
  totpCode: string;
}
