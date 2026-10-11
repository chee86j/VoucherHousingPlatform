import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCaseDto {
  @IsString() @IsNotEmpty() clientId!: string;
  @IsString() @IsNotEmpty() ownerUserId!: string;
}
export class TransitionDto {
  @IsString() @IsNotEmpty() action!: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
  @IsOptional() @IsString() @IsNotEmpty() voucherId?: string;
  @IsOptional() @IsString() @IsNotEmpty() unitId?: string;
}
export class EvaluateDto {
  @IsString() @IsNotEmpty() voucherId!: string;
  @IsString() @IsNotEmpty() unitId!: string;
}
