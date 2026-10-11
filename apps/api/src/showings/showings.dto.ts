import { IsArray, ArrayUnique, ArrayMinSize, ArrayMaxSize, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ParticipantStatus } from '@vhp/database';

export class CreateShowingDto {
  @IsString() @IsNotEmpty() unitId!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ArrayUnique() @IsString({ each: true }) @IsNotEmpty({ each: true }) clientIds!: string[];
}
export class InviteDto { @IsString() @IsNotEmpty() clientId!: string; }
export class ParticipantStatusDto { @IsEnum(ParticipantStatus) status!: ParticipantStatus; }
export class CreateTaskDto {
  @IsString() @IsNotEmpty() @MaxLength(200) title!: string;
  @IsDateString() dueAt!: string;
  @IsString() @IsNotEmpty() ownerUserId!: string;
  @IsOptional() @IsString() @IsNotEmpty() sessionId?: string;
  @IsOptional() @IsString() @IsNotEmpty() caseId?: string;
}
