import {defineStorage} from '@aws-amplify/backend';

export const storage = defineStorage({
    name: 'wearnowStorage',
    access: (allow) => ({
        'user-photos/{entity_id}/*': [
            allow.entity('identity').to(['read', 'write', 'delete']),
        ],
        'garment-photos/{entity_id}/*': [
            allow.entity('identity').to(['read', 'write', 'delete']),
        ],
        'tryon-results/{entity_id}/*': [
            allow.entity('identity').to(['read', 'write', 'delete']),
        ],
    }),
});

