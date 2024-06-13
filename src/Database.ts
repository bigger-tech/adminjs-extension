import { DataSource } from 'typeorm'

import { BaseDatabase } from 'adminjs'
import { Resource, ResourceType } from './Resource.js'

export class Database extends BaseDatabase {
  public constructor(public readonly dataSource: DataSource) {
    super(dataSource)
  }

  public resources(): Array<Resource> {
    const resources: Array<Resource> = []
    // eslint-disable-next-line no-restricted-syntax
    for (const entityMetadata of this.dataSource.entityMetadatas) {
      resources.push(
        new Resource(
          (entityMetadata as unknown) as ResourceType,
        ),
      )
    }

    return resources
  }

  public static isAdapterFor(dataSource: DataSource): boolean {
    return !!dataSource.entityMetadatas
  }
}
