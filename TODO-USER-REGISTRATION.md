# User Registration — Implementation Checklist

**Module:** `src/modules/user/`  
**Architecture:** Clean Architecture (domain → application → infrastructure → presentation)  
**Prerequisite:** NestJS project initialized (Phase 1 Foundation)

---

## Folder Structure

```
src/modules/user/
├── user.module.ts
│
├── domain/
│   ├── entities/
│   │   └── user.entity.ts
│   ├── value-objects/
│   │   ├── email.vo.ts
│   │   └── hashed-password.vo.ts
│   └── errors/
│       └── user.errors.ts
│
├── application/
│   ├── ports/
│   │   ├── user.repository.port.ts
│   │   └── password-hasher.port.ts
│   └── use-cases/
│       └── register-user/
│           ├── register-user.use-case.ts
│           └── register-user.dto.ts
│
├── infrastructure/
│   ├── security/
│   │   └── bcrypt-password-hasher.ts
│   └── persistence/
│       └── postgres/
│           ├── user.orm-entity.ts
│           └── postgres-user.repository.ts
│
└── presentation/
    ├── user.controller.ts
    └── dto/
        ├── register-user.request.dto.ts
        └── register-user.response.dto.ts
```

---

## Checklist

### 0. Project Bootstrap

- [ ] Initialize NestJS project (`nest new biseocore --strict`)
- [ ] Install dependencies: `class-validator`, `class-transformer`, `uuid`, `bcrypt`, `@types/bcrypt`, `@nestjs/typeorm`, `typeorm`, `pg`
- [ ] Enable global validation pipe in `main.ts`
- [ ] Create `src/modules/` and `src/shared/` directories

### 1. Domain Layer — `user/domain/`

> Pure TypeScript. No framework imports. No I/O.

- [ ] Create `Email` value object
- [ ] Create `HashedPassword` value object
- [ ] Create `User` entity (aggregate root)
- [ ] Create domain error classes

#### 1.1 `domain/value-objects/email.vo.ts`

```typescript
export class Email {
  private constructor(private readonly value: string) {}

  static create(email: string): Email {
    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      throw new InvalidEmailError(email);
    }
    return new Email(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}

import { InvalidEmailError } from '../errors/user.errors';
```

#### 1.2 `domain/value-objects/hashed-password.vo.ts`

```typescript
export class HashedPassword {
  private constructor(private readonly value: string) {}

  /**
   * Wraps an already-hashed string.
   * Hashing itself is done in infrastructure (bcrypt adapter).
   */
  static fromHash(hash: string): HashedPassword {
    if (!hash || hash.length === 0) {
      throw new Error('Hashed password cannot be empty');
    }
    return new HashedPassword(hash);
  }

  toString(): string {
    return this.value;
  }
}
```

#### 1.3 `domain/entities/user.entity.ts`

```typescript
import { Email } from '../value-objects/email.vo';
import { HashedPassword } from '../value-objects/hashed-password.vo';

export class User {
  private constructor(
    public readonly id: string,
    public readonly email: Email,
    public readonly username: string,
    public readonly hashedPassword: HashedPassword,
    public readonly createdAt: Date,
  ) {}

  /** Factory for NEW users (sets createdAt = now) */
  static create(params: {
    id: string;
    email: Email;
    username: string;
    hashedPassword: HashedPassword;
  }): User {
    if (!params.username || params.username.trim().length < 3) {
      throw new InvalidUsernameError(params.username);
    }

    return new User(
      params.id,
      params.email,
      params.username.trim(),
      params.hashedPassword,
      new Date(),
    );
  }

  /** Reconstitute from persistence (no validation, no new Date) */
  static reconstitute(params: {
    id: string;
    email: Email;
    username: string;
    hashedPassword: HashedPassword;
    createdAt: Date;
  }): User {
    return new User(
      params.id,
      params.email,
      params.username,
      params.hashedPassword,
      params.createdAt,
    );
  }
}

import { InvalidUsernameError } from '../errors/user.errors';
```

#### 1.4 `domain/errors/user.errors.ts`

```typescript
export class UserDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidEmailError extends UserDomainError {
  constructor(email: string) {
    super(`Invalid email format: "${email}"`);
  }
}

export class InvalidUsernameError extends UserDomainError {
  constructor(username: string) {
    super(`Username must be at least 3 characters. Got: "${username}"`);
  }
}

export class EmailAlreadyExistsError extends UserDomainError {
  constructor(email: string) {
    super(`A user with email "${email}" already exists`);
  }
}

export class UsernameAlreadyExistsError extends UserDomainError {
  constructor(username: string) {
    super(`A user with username "${username}" already exists`);
  }
}
```

---

### 2. Application Layer — `user/application/`

> Depends on domain only. Defines port interfaces. No framework deps.

- [ ] Define `IUserRepository` port
- [ ] Define `IPasswordHasher` port
- [ ] Create `RegisterUserUseCase`
- [ ] Create use-case DTOs

#### 2.1 `application/ports/user.repository.port.ts`

```typescript
import { User } from '../../domain/entities/user.entity';
import { Email } from '../../domain/value-objects/email.vo';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface IUserRepository {
  save(user: User): Promise<void>;
  findByEmail(email: Email): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}
```

#### 2.2 `application/ports/password-hasher.port.ts`

```typescript
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

export interface IPasswordHasher {
  hash(plainPassword: string): Promise<string>;
  compare(plainPassword: string, hashedPassword: string): Promise<boolean>;
}
```

#### 2.3 `application/use-cases/register-user/register-user.dto.ts`

```typescript
/** Input DTO for the use case (application boundary) */
export interface RegisterUserInput {
  email: string;
  username: string;
  password: string;
}

/** Output DTO for the use case */
export interface RegisterUserOutput {
  id: string;
  email: string;
  username: string;
  createdAt: Date;
}
```

#### 2.4 `application/use-cases/register-user/register-user.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { User } from '../../../domain/entities/user.entity';
import { Email } from '../../../domain/value-objects/email.vo';
import { HashedPassword } from '../../../domain/value-objects/hashed-password.vo';
import {
  EmailAlreadyExistsError,
  UsernameAlreadyExistsError,
} from '../../../domain/errors/user.errors';

import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../ports/user.repository.port';
import {
  IPasswordHasher,
  PASSWORD_HASHER,
} from '../../ports/password-hasher.port';
import { RegisterUserInput, RegisterUserOutput } from './register-user.dto';

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,

    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: IPasswordHasher,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    // 1. Validate email format (domain rule)
    const email = Email.create(input.email);

    // 2. Check uniqueness
    const existingByEmail = await this.userRepository.findByEmail(email);
    if (existingByEmail) {
      throw new EmailAlreadyExistsError(input.email);
    }

    const existingByUsername = await this.userRepository.findByUsername(
      input.username,
    );
    if (existingByUsername) {
      throw new UsernameAlreadyExistsError(input.username);
    }

    // 3. Hash password (infrastructure via port)
    const hash = await this.passwordHasher.hash(input.password);
    const hashedPassword = HashedPassword.fromHash(hash);

    // 4. Create domain entity
    const user = User.create({
      id: uuidv4(),
      email,
      username: input.username,
      hashedPassword,
    });

    // 5. Persist
    await this.userRepository.save(user);

    // 6. Return output DTO (never expose hashedPassword)
    return {
      id: user.id,
      email: user.email.toString(),
      username: user.username,
      createdAt: user.createdAt,
    };
  }
}
```

---

### 3. Infrastructure Layer — `user/infrastructure/`

> Implements ports. Framework/library dependencies live here.

- [ ] Implement `BcryptPasswordHasher`
- [ ] Create `UserOrmEntity` (TypeORM schema — maps to/from domain entity)
- [ ] Implement `PostgresUserRepository`
- [ ] Configure TypeORM connection in `AppModule`

#### 3.1 `infrastructure/security/bcrypt-password-hasher.ts`

```typescript
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { IPasswordHasher } from '../../application/ports/password-hasher.port';

@Injectable()
export class BcryptPasswordHasher implements IPasswordHasher {
  private readonly SALT_ROUNDS = 12;

  async hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, this.SALT_ROUNDS);
  }

  async compare(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}
```

#### 3.2 `infrastructure/persistence/postgres/user.orm-entity.ts`

```typescript
import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('users')
export class UserOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  username: string;

  @Column({ type: 'varchar', length: 255 })
  hashedPassword: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
```

#### 3.3 `infrastructure/persistence/postgres/postgres-user.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IUserRepository } from '../../../application/ports/user.repository.port';
import { User } from '../../../domain/entities/user.entity';
import { Email } from '../../../domain/value-objects/email.vo';
import { HashedPassword } from '../../../domain/value-objects/hashed-password.vo';
import { UserOrmEntity } from './user.orm-entity';

@Injectable()
export class PostgresUserRepository implements IUserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repo: Repository<UserOrmEntity>,
  ) {}

  async save(user: User): Promise<void> {
    const orm = new UserOrmEntity();
    orm.id = user.id;
    orm.email = user.email.toString();
    orm.username = user.username;
    orm.hashedPassword = user.hashedPassword.toString();
    orm.createdAt = user.createdAt;
    await this.repo.save(orm);
  }

  async findByEmail(email: Email): Promise<User | null> {
    const orm = await this.repo.findOne({ where: { email: email.toString() } });
    return orm ? this.toDomain(orm) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const orm = await this.repo.findOne({ where: { username } });
    return orm ? this.toDomain(orm) : null;
  }

  async findById(id: string): Promise<User | null> {
    const orm = await this.repo.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  private toDomain(orm: UserOrmEntity): User {
    return User.reconstitute({
      id: orm.id,
      email: Email.create(orm.email),
      username: orm.username,
      hashedPassword: HashedPassword.fromHash(orm.hashedPassword),
      createdAt: orm.createdAt,
    });
  }
}
```

---

### 4. Presentation Layer — `user/presentation/`

> HTTP interface. Validation DTOs. Maps to/from use-case DTOs.

- [ ] Create request DTO with `class-validator` decorators
- [ ] Create response DTO
- [ ] Create `UserController` with `POST /auth/register`
- [ ] Add domain-error-to-HTTP exception mapping

#### 4.1 `presentation/dto/register-user.request.dto.ts`

```typescript
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterUserRequestDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  password: string;
}
```

#### 4.2 `presentation/dto/register-user.response.dto.ts`

```typescript
export class RegisterUserResponseDto {
  id: string;
  email: string;
  username: string;
  createdAt: string; // ISO 8601
}
```

#### 4.3 `presentation/user.controller.ts`

```typescript
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

import { RegisterUserUseCase } from '../application/use-cases/register-user/register-user.use-case';
import { RegisterUserRequestDto } from './dto/register-user.request.dto';
import { RegisterUserResponseDto } from './dto/register-user.response.dto';
import {
  EmailAlreadyExistsError,
  UsernameAlreadyExistsError,
  UserDomainError,
} from '../domain/errors/user.errors';

@Controller('auth')
export class UserController {
  constructor(private readonly registerUser: RegisterUserUseCase) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterUserRequestDto,
  ): Promise<RegisterUserResponseDto> {
    try {
      const result = await this.registerUser.execute({
        email: dto.email,
        username: dto.username,
        password: dto.password,
      });

      return {
        id: result.id,
        email: result.email,
        username: result.username,
        createdAt: result.createdAt.toISOString(),
      };
    } catch (error) {
      if (
        error instanceof EmailAlreadyExistsError ||
        error instanceof UsernameAlreadyExistsError
      ) {
        throw new ConflictException(error.message);
      }
      if (error instanceof UserDomainError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
```

---

### 5. Module Wiring — `user.module.ts`

> Binds ports to adapters via NestJS DI.

- [ ] Create `UserModule` and wire all DI tokens

#### 5.1 `user.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RegisterUserUseCase } from './application/use-cases/register-user/register-user.use-case';
import { USER_REPOSITORY } from './application/ports/user.repository.port';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port';

import { PostgresUserRepository } from './infrastructure/persistence/postgres/postgres-user.repository';
import { UserOrmEntity } from './infrastructure/persistence/postgres/user.orm-entity';
import { BcryptPasswordHasher } from './infrastructure/security/bcrypt-password-hasher';

import { UserController } from './presentation/user.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  controllers: [UserController],
  providers: [
    RegisterUserUseCase,
    {
      provide: USER_REPOSITORY,
      useClass: PostgresUserRepository,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: BcryptPasswordHasher,
    },
  ],
  exports: [USER_REPOSITORY],
})
export class UserModule {}
```

---

### 6. Integration

- [ ] Configure `TypeOrmModule.forRootAsync()` in `AppModule` with PostgreSQL
- [ ] Add `.env` with database credentials
- [ ] Install `@nestjs/config` for env loading
- [ ] Import `UserModule` in `AppModule`
- [ ] Ensure PostgreSQL is running (`docker run --name biseocore-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=biseocore -p 5432:5432 -d postgres:16`)
- [ ] Test endpoint manually: `POST /auth/register`

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'postgres'),
        password: config.get('DB_PASSWORD', 'postgres'),
        database: config.get('DB_NAME', 'biseocore'),
        autoLoadEntities: true,
        synchronize: config.get('DB_SYNC', 'true') === 'true', // false in production
      }),
    }),
    UserModule,
  ],
})
export class AppModule {}
```

#### `.env`

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=biseocore
DB_SYNC=true
```

---

### 7. Unit Tests

- [ ] Test `Email.create()` — valid/invalid formats
- [ ] Test `User.create()` — valid params, short username
- [ ] Test `RegisterUserUseCase` — happy path, duplicate email, duplicate username

#### 7.1 `test/unit/modules/user/domain/email.vo.spec.ts`

```typescript
import { Email } from '../../../../../src/modules/user/domain/value-objects/email.vo';

describe('Email', () => {
  it('should create a valid email', () => {
    const email = Email.create('Test@Example.COM');
    expect(email.toString()).toBe('test@example.com');
  });

  it('should reject invalid email', () => {
    expect(() => Email.create('not-an-email')).toThrow('Invalid email');
  });

  it('should support equality', () => {
    const a = Email.create('a@b.com');
    const b = Email.create('A@B.COM');
    expect(a.equals(b)).toBe(true);
  });
});
```

#### 7.2 `test/unit/modules/user/application/register-user.use-case.spec.ts`

```typescript
import { RegisterUserUseCase } from '../../../../../src/modules/user/application/use-cases/register-user/register-user.use-case';
import { IUserRepository } from '../../../../../src/modules/user/application/ports/user.repository.port';
import { IPasswordHasher } from '../../../../../src/modules/user/application/ports/password-hasher.port';

describe('RegisterUserUseCase', () => {
  let useCase: RegisterUserUseCase;
  let userRepo: jest.Mocked<IUserRepository>;
  let hasher: jest.Mocked<IPasswordHasher>;

  beforeEach(() => {
    userRepo = {
      save: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(null),
      findByUsername: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
    };

    hasher = {
      hash: jest.fn().mockResolvedValue('hashed_pw'),
      compare: jest.fn(),
    };

    useCase = new RegisterUserUseCase(userRepo, hasher);
  });

  it('should register a new user', async () => {
    const result = await useCase.execute({
      email: 'user@test.com',
      username: 'testuser',
      password: 'securepass',
    });

    expect(result.email).toBe('user@test.com');
    expect(result.username).toBe('testuser');
    expect(result.id).toBeDefined();
    expect(userRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should throw on duplicate email', async () => {
    userRepo.findByEmail.mockResolvedValue({} as any);

    await expect(
      useCase.execute({
        email: 'dup@test.com',
        username: 'newuser',
        password: 'securepass',
      }),
    ).rejects.toThrow('already exists');
  });

  it('should throw on duplicate username', async () => {
    userRepo.findByUsername.mockResolvedValue({} as any);

    await expect(
      useCase.execute({
        email: 'new@test.com',
        username: 'dupuser',
        password: 'securepass',
      }),
    ).rejects.toThrow('already exists');
  });
});
```

---

### 8. Manual Verification

- [ ] Start the app: `npm run start:dev`
- [ ] Register a user:

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "username": "alice", "password": "mypassword1"}'
```

Expected response (`201 Created`):
```json
{
  "id": "uuid-here",
  "email": "alice@example.com",
  "username": "alice",
  "createdAt": "2026-03-03T..."
}
```

- [ ] Duplicate email → `409 Conflict`
- [ ] Invalid email → `400 Bad Request`
- [ ] Short password → `400 Bad Request`
- [ ] Short username → `400 Bad Request`

---

## Summary

| Layer          | Files | Framework? |
|----------------|-------|-----------|
| Domain         | 4     | None      |
| Application    | 4     | NestJS `@Injectable` + `@Inject` only |
| Infrastructure | 3     | NestJS, TypeORM, bcrypt, pg |
| Presentation   | 3     | NestJS    |
| Module wiring  | 1     | NestJS    |
| **Total**      | **15**|           |
