import { Entity } from '@backstage/catalog-model';
import { CatalogProcessorResult } from '@backstage/plugin-catalog-node';
import { NervStreamProducerProcessor } from './nervEventStreams';

const location = {
  type: 'url',
  target: 'https://example.com/catalog-info.yaml',
};

function api(annotations: Record<string, string> = {}): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'API',
    metadata: { name: 'billing-customer-bill-state-v1', annotations },
    spec: { type: 'asyncapi', lifecycle: 'production', owner: 'team' },
  };
}

async function process(entity: Entity): Promise<CatalogProcessorResult[]> {
  const results: CatalogProcessorResult[] = [];
  await new NervStreamProducerProcessor().postProcessEntity(
    entity,
    location,
    r => results.push(r),
  );
  return results;
}

describe('NervStreamProducerProcessor', () => {
  it('relates the API and its producer in both directions', async () => {
    const results = await process(
      api({
        'nerv.io/producer': 'component:default/customer-bill-state-projector',
      }),
    );
    const self = {
      kind: 'API',
      namespace: 'default',
      name: 'billing-customer-bill-state-v1',
    };
    const producer = {
      kind: 'component',
      namespace: 'default',
      name: 'customer-bill-state-projector',
    };
    expect(results).toEqual([
      {
        type: 'relation',
        relation: { source: self, type: 'apiProvidedBy', target: producer },
      },
      {
        type: 'relation',
        relation: { source: producer, type: 'providesApi', target: self },
      },
    ]);
  });

  it('defaults to a Component in the API namespace', async () => {
    const results = await process(api({ 'nerv.io/producer': 'projector' }));
    expect(results[0]).toMatchObject({
      relation: {
        target: { kind: 'Component', namespace: 'default', name: 'projector' },
      },
    });
  });

  it('rejects producers that are not Components', async () => {
    const results = await process(
      api({ 'nerv.io/producer': 'group:default/team' }),
    );
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('error');
  });

  it('ignores APIs without the annotation and other kinds', async () => {
    expect(await process(api())).toEqual([]);
    expect(
      await process({ ...api({ 'nerv.io/producer': 'x' }), kind: 'Component' }),
    ).toEqual([]);
  });
});
