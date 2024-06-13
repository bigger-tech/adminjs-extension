/* eslint-disable no-param-reassign */
import { BaseRecord, BaseResource, Filter, flat, ValidationError } from 'adminjs'
import { BaseEntity, DataSource, EntitySchema, In, Repository } from 'typeorm'

import { Property } from './Property.js'
import { convertFilter } from './utils/filter/filter.converter.js'
import safeParseNumber from './utils/safe-parse-number.js'

type ParamsType = Record<string, any>;

export type ResourceType = {
  schema: EntitySchema;
  datasource: DataSource;
};

export class Resource extends BaseResource {
  public static validate: any

  private propsObject: Record<string, Property> = {}

  private repository: Repository<any>

  constructor(resource: ResourceType) {
    super(resource.schema)
    this.repository = resource.datasource.getRepository(resource.schema)
    this.propsObject = this.prepareProps()
  }

  public databaseName(): string {
    return this.getRepository().metadata.connection.options.database as string || 'typeorm'
  }

  public databaseType(): string {
    return (
      this.getRepository().metadata.connection.options.type || 'typeorm'
    )
  }

  public name(): string {
    return this.getRepository().metadata.name
  }

  public id(): string {
    return this.getRepository().metadata.name
  }

  public properties(): Array<Property> {
    return [...Object.values(this.propsObject)]
  }

  public property(path: string): Property {
    return this.propsObject[path]
  }

  getRepository() {
    return this.repository
  }

  public async count(filter: Filter): Promise<number> {
    return this.getRepository().count({
      where: convertFilter(filter),
    })
  }

  public async find(filter: Filter, params: any): Promise<Array<BaseRecord>> {
    const { limit = 10, offset = 0, sort = {} } = params
    const { direction, sortBy } = sort as any
    const instances = await this.getRepository().find({
      where: convertFilter(filter),
      take: limit,
      skip: offset,
      order: {
        [sortBy]: (direction || 'asc').toUpperCase(),
      },
    })
    return instances.map((instance) => new BaseRecord(instance, this))
  }

  public async findOne(id: string | number): Promise<BaseRecord | null> {
    const instance = await this.getRepository().findOne({ where: { id } })
    if (!instance) {
      return null
    }
    return new BaseRecord(instance, this)
  }

  public async findMany(
    ids: Array<string | number>,
  ): Promise<Array<BaseRecord>> {
    const instances = await this.getRepository().findBy({ id: In(ids) })

    return instances.map((instance) => new BaseRecord(instance, this))
  }

  public async create(params: Record<string, any>): Promise<ParamsType> {
    const instance = await this.getRepository().create(
      this.prepareParams(params),
    )

    await this.validateAndSave(instance)

    return instance
  }

  public async update(
    pk: string | number,
    params: any = {},
  ): Promise<ParamsType> {
    const instance = await this.getRepository().findOne({ where: { id: pk } })
    if (instance) {
      const preparedParams = flat.unflatten(this.prepareParams(params))
      Object.keys(preparedParams).forEach((paramName) => {
        instance[paramName] = preparedParams[paramName]
      })
      await this.validateAndSave(instance)
      return instance
    }
    throw new Error('Instance not found.')
  }

  public async delete(pk: string | number): Promise<any> {
    try {
      await this.getRepository().delete(pk)
    } catch (error) {
      if ((error as any).name === 'QueryFailedError') {
        throw new ValidationError(
          {},
          {
            type: 'QueryFailedError',
            message: (error as any).message,
          },
        )
      }
      throw error
    }
  }

  private prepareProps(): Record<string, Property> {
    const { columns } = this.getRepository().metadata
    return columns.reduce((memo, col, index) => {
      const property = new Property(col, index)
      return {
        ...memo,
        [property.path()]: property,
      }
    }, {})
  }

  /** Converts params from string to final type */
  private prepareParams(params: Record<string, any>): Record<string, any> {
    const preparedParams: Record<string, any> = { ...params }

    this.properties().forEach((property) => {
      const param = flat.get(preparedParams, property.path())
      const key = property.path()

      // eslint-disable-next-line no-continue
      if (param === undefined) {
        return
      }

      const type = property.type()

      if (type === 'mixed') {
        preparedParams[key] = param
      }

      if (type === 'number') {
        if (property.isArray()) {
          preparedParams[key] = param
            ? param.map((p: any) => safeParseNumber(p))
            : param
        } else {
          preparedParams[key] = safeParseNumber(param)
        }
      }

      if (type === 'reference') {
        if (param === null) {
          preparedParams[property.column.propertyName] = null
        } else {
          const [
            ref,
            foreignKey,
          ] = property.column.propertyPath.split('.')
          const id = property.column.type === Number ? Number(param) : param
          preparedParams[ref] = foreignKey
            ? {
              [foreignKey]: id,
            }
            : id
        }
      }
    })

    return preparedParams
  }

  // eslint-disable-next-line class-methods-use-this
  async validateAndSave(instance: BaseEntity): Promise<any> {
    if (Resource.validate) {
      const errors = await Resource.validate(instance)
      if (errors && errors.length) {
        const validationErrors = errors.reduce(
          (memo: any, error: any) => ({
            ...memo,
            [error.property]: {
              type: Object.keys(error.constraints)[0],
              message: Object.values(error.constraints)[0],
            },
          }),
          {},
        )
        throw new ValidationError(validationErrors)
      }
    }
    try {
      await this.getRepository().save(instance)
    } catch (error) {
      if ((error as any).name === 'QueryFailedError') {
        throw new ValidationError({
          [(error as any).column]: {
            type: 'QueryFailedError',
            message: (error as any).message,
          },
        })
      }
    }
  }

  public static isAdapterFor(rawResource: any): boolean {
    try {
      // eslint-disable-next-line no-console
      const repository = rawResource.datasource.getRepository(rawResource.schema)
      return !!repository.metadata
    } catch (e) {
      return false
    }
  }
}
