import { createBackendModule } from '@backstage/backend-plugin-api';
import {
  CompoundEntityRef,
  Entity,
  getCompoundEntityRef,
  parseEntityRef,
  RELATION_API_PROVIDED_BY,
  RELATION_PROVIDES_API,
} from '@backstage/catalog-model';
import {
  CatalogProcessor,
  CatalogProcessorEmit,
  catalogProcessingExtensionPoint,
  LocationSpec,
  processingResult,
} from '@backstage/plugin-catalog-node';

/** API annotation that names the Component producing an event stream. */
export const PRODUCER_ANNOTATION = 'nerv.io/producer';

/**
 * Links an event stream API to its producer. Stream folders in Central Dogma
 * declare the producer with the `nerv.io/producer` annotation instead of
 * editing the producer's own catalog-info.yaml, which lives in another
 * repository. This processor adds the same relations as `providesApis`.
 */
export class NervStreamProducerProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'NervStreamProducerProcessor';
  }

  async postProcessEntity(
    entity: Entity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (entity.kind !== 'API') {
      return entity;
    }
    const producer = entity.metadata.annotations?.[PRODUCER_ANNOTATION];
    if (!producer) {
      return entity;
    }

    let target: CompoundEntityRef;
    try {
      target = parseEntityRef(producer, {
        defaultKind: 'Component',
        defaultNamespace: entity.metadata.namespace ?? 'default',
      });
    } catch (error) {
      emit(
        processingResult.inputError(
          location,
          `${PRODUCER_ANNOTATION} must be an entity reference, got "${producer}": ${error}`,
        ),
      );
      return entity;
    }
    if (target.kind.toLocaleLowerCase('en-US') !== 'component') {
      emit(
        processingResult.inputError(
          location,
          `${PRODUCER_ANNOTATION} must reference a Component, got "${producer}"`,
        ),
      );
      return entity;
    }

    const self = getCompoundEntityRef(entity);
    emit(
      processingResult.relation({
        source: self,
        type: RELATION_API_PROVIDED_BY,
        target,
      }),
    );
    emit(
      processingResult.relation({
        source: target,
        type: RELATION_PROVIDES_API,
        target: self,
      }),
    );
    return entity;
  }
}

export default createBackendModule({
  pluginId: 'catalog',
  moduleId: 'nerv-event-streams',
  register({ registerInit }) {
    registerInit({
      deps: { catalog: catalogProcessingExtensionPoint },
      async init({ catalog }) {
        catalog.addProcessor(new NervStreamProducerProcessor());
      },
    });
  },
});
