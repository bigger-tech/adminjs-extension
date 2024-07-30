import dotenv from 'dotenv'
import { DataSourceOptions } from 'typeorm'
import { Car } from './entities/Car.js'
import { Seller } from './entities/Seller.js'
import { User } from './entities/User.js'
import { BrandSchema } from './schemas/brand.schema.js'

dotenv.config()

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: +(process.env.POSTGRES_PORT || 5432),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  database: process.env.POSTGRES_DATABASE || 'database_test',
  entities: [User, Car, Seller, BrandSchema],
  migrations: ['../migration/**/*.js'],
  subscribers: ['../subscriber/**/*.js'],
  synchronize: true,
  logging: true,
}
