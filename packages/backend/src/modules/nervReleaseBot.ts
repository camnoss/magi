import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { InputError } from '@backstage/errors';
import { ScmIntegrations } from '@backstage/integration';
import {
  getOctokitClient,
  getOctokitOptions,
} from '@backstage/plugin-scaffolder-backend-module-github';
import {
  createTemplateAction,
  parseRepoUrl,
  scaffolderActionsExtensionPoint,
} from '@backstage/plugin-scaffolder-node';
import Sodium from 'libsodium-wrappers';

// Actions secret that service CI uses to send image-published dispatches to
// Central Dogma. See the "Automatic dev deployments" section of its README.
const SECRET_NAME = 'DOGMA_DISPATCH_TOKEN';

/**
 * Adds the `nerv:release-bot:connect` scaffolder action. It copies the Central
 * Dogma dispatch token from `nerv.releaseBot.dispatchToken` into a repository
 * as an Actions secret, so the repository's CI can trigger the release bot.
 */
export default createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'nerv-release-bot',
  register({ registerInit }) {
    registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        config: coreServices.rootConfig,
      },
      async init({ scaffolder, config }) {
        const integrations = ScmIntegrations.fromConfig(config);

        scaffolder.addActions(
          createTemplateAction({
            id: 'nerv:release-bot:connect',
            description: `Connects a repository to the Central Dogma release bot by setting its ${SECRET_NAME} Actions secret.`,
            schema: {
              input: {
                repoUrl: z =>
                  z.string({
                    description:
                      'Repository to connect, as github.com?owner=<owner>&repo=<repo>',
                  }),
              },
            },
            async handler(ctx) {
              const dispatchToken = config.getOptionalString(
                'nerv.releaseBot.dispatchToken',
              );
              if (!dispatchToken) {
                ctx.logger.warn(
                  `nerv.releaseBot.dispatchToken is not set, so ${SECRET_NAME} was not added. New images will deploy on the release bot's hourly run instead of right after each merge.`,
                );
                return;
              }

              const { host, owner, repo } = parseRepoUrl(
                ctx.input.repoUrl,
                integrations,
              );
              if (!owner) {
                throw new InputError(
                  `No owner in repoUrl ${ctx.input.repoUrl}`,
                );
              }

              const client = getOctokitClient(
                await getOctokitOptions({ integrations, host, owner, repo }),
                ctx.logger,
              );

              // Actions secrets are sealed with the repository's public key.
              const { data: publicKey } =
                await client.rest.actions.getRepoPublicKey({ owner, repo });
              await Sodium.ready;
              const sealed = Sodium.crypto_box_seal(
                Sodium.from_string(dispatchToken),
                Sodium.from_base64(
                  publicKey.key,
                  Sodium.base64_variants.ORIGINAL,
                ),
              );

              await client.rest.actions.createOrUpdateRepoSecret({
                owner,
                repo,
                secret_name: SECRET_NAME,
                encrypted_value: Sodium.to_base64(
                  sealed,
                  Sodium.base64_variants.ORIGINAL,
                ),
                key_id: publicKey.key_id,
              });

              ctx.logger.info(`Set ${SECRET_NAME} on ${owner}/${repo}`);
            },
          }),
        );
      },
    });
  },
});
