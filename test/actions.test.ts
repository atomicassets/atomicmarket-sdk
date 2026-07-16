import { expect } from 'chai';

import {
    AtomicMarketActions, EosioActionData, EosioActionObject, EosioAuthorizationObject,
    MarketActionBuilder, MarketActionGenerator
} from '../src';

describe('MarketActionGenerator royalty action helpers', () => {
    const contract = 'atomicmarket';
    const generator = new MarketActionGenerator(contract);
    const authorization: EosioAuthorizationObject[] = [{actor: 'creator', permission: 'active'}];

    it('setroyalconf emits founders as {recipient, weight}[] with numeric weights and the split/mode fields', async () => {
        const actions = await generator.setroyalconf(authorization, 'mycollection', {
            founders: [{recipient: 'alice', weight: '5000'}, {recipient: 'bob', weight: 5000}],
            attribute_mode: 1,
            split_founders: 5000,
            split_templates: 3000,
            split_attributes: 2000
        });

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'setroyalconf',
            authorization,
            data: {
                collection_name: 'mycollection',
                founders: [{recipient: 'alice', weight: 5000}, {recipient: 'bob', weight: 5000}],
                attribute_mode: 1,
                split_founders: 5000,
                split_templates: 3000,
                split_attributes: 2000
            }
        }]);
    });

    it('settemplroy emits collection_name, template_id and recipients', async () => {
        const actions = await generator.settemplroy(
            authorization, 'mycollection', '42', [{recipient: 'alice', weight: '10000'}]
        );

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'settemplroy',
            authorization,
            data: {
                collection_name: 'mycollection',
                template_id: 42,
                recipients: [{recipient: 'alice', weight: 10000}]
            }
        }]);
    });

    it('deltemplroy emits collection_name and template_id', async () => {
        const actions = await generator.deltemplroy(authorization, 'mycollection', 42);

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'deltemplroy',
            authorization,
            data: {
                collection_name: 'mycollection',
                template_id: 42
            }
        }]);
    });

    it('setattrroy emits source/field/value/rule_weight/recipients with value passed through verbatim', async () => {
        const value: [string, unknown] = ['uint64', '100'];

        const actions = await generator.setattrroy(
            authorization, 'mycollection', 1, 'level', value, '10000', [{recipient: 'alice', weight: '10000'}]
        );

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'setattrroy',
            authorization,
            data: {
                collection_name: 'mycollection',
                source: 1,
                field: 'level',
                value,
                rule_weight: 10000,
                recipients: [{recipient: 'alice', weight: 10000}]
            }
        }]);
        expect(actions[0].data.value).to.equal(value);
    });

    it('delattrroy emits collection_name and rule_id as a string (uint64)', async () => {
        const actions = await generator.delattrroy(authorization, 'mycollection', '7');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'delattrroy',
            authorization,
            data: {
                collection_name: 'mycollection',
                rule_id: '7'
            }
        }]);
    });

    it('delattrroy passes uint64 rule_id strings above 2^53 through without precision loss', async () => {
        const ruleId = '18446744073709551615';
        const actions = await generator.delattrroy(authorization, 'mycollection', ruleId);

        expect(actions[0].data.rule_id).to.equal(ruleId);
    });

    it('delattrroy passes typical string rule_id input through', async () => {
        const actions = await generator.delattrroy(authorization, 'mycollection', '7');

        expect(actions[0].data.rule_id).to.equal('7');
    });

    it('delroyalconf emits only collection_name', async () => {
        const actions = await generator.delroyalconf(authorization, 'mycollection');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'delroyalconf',
            authorization,
            data: {
                collection_name: 'mycollection'
            }
        }]);
    });

    it('none of the six royalty actions include an authorized_* key in data', async () => {
        const value: [string, unknown] = ['uint64', '100'];

        const allActions = [
            ...await generator.setroyalconf(authorization, 'mycollection', {
                founders: [{recipient: 'alice', weight: 5000}],
                attribute_mode: 0, split_founders: 5000, split_templates: 3000, split_attributes: 2000
            }),
            ...await generator.settemplroy(authorization, 'mycollection', 1, [{recipient: 'alice', weight: 10000}]),
            ...await generator.setattrroy(authorization, 'mycollection', 1, 'level', value, 10000, [{recipient: 'alice', weight: 10000}]),
            ...await generator.deltemplroy(authorization, 'mycollection', 1),
            ...await generator.delattrroy(authorization, 'mycollection', '1'),
            ...await generator.delroyalconf(authorization, 'mycollection')
        ];

        for (const action of allActions) {
            const authorizedKeys = Object.keys(action.data).filter((key) => key.startsWith('authorized_'));
            expect(authorizedKeys, `${action.name} data keys: ${Object.keys(action.data).join(',')}`).to.have.lengthOf(0);
        }
    });
});

describe('MarketActionBuilder sync layer', () => {
    const contract = 'atomicmarket';
    const builder = new MarketActionBuilder(contract);
    const generator = new MarketActionGenerator(contract);
    const authorization: EosioAuthorizationObject[] = [{actor: 'creator', permission: 'active'}];

    it('returns authorization-free {account, name, data} actions', () => {
        const actions = builder.settemplroy('mycollection', '42', [{recipient: 'alice', weight: '10000'}]);

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'settemplroy',
            data: {
                collection_name: 'mycollection',
                template_id: 42,
                recipients: [{recipient: 'alice', weight: 10000}]
            }
        }]);
        expect(actions[0]).to.not.have.property('authorization');
    });

    it('the async generator emits the builder payload plus the authorization', async () => {
        const config = {
            founders: [{recipient: 'alice', weight: 5000}],
            attribute_mode: 1, split_founders: 5000, split_templates: 3000, split_attributes: 2000
        };
        const value: [string, unknown] = ['uint64', '100'];

        const cases: Array<[EosioActionData[], EosioActionObject[]]> = [
            [builder.setroyalconf('mycollection', config), await generator.setroyalconf(authorization, 'mycollection', config)],
            [builder.settemplroy('mycollection', 1, config.founders), await generator.settemplroy(authorization, 'mycollection', 1, config.founders)],
            [builder.setattrroy('mycollection', 1, 'level', value, 10000, config.founders), await generator.setattrroy(authorization, 'mycollection', 1, 'level', value, 10000, config.founders)],
            [builder.deltemplroy('mycollection', 1), await generator.deltemplroy(authorization, 'mycollection', 1)],
            [builder.delattrroy('mycollection', '1'), await generator.delattrroy(authorization, 'mycollection', '1')],
            [builder.delroyalconf('mycollection'), await generator.delroyalconf(authorization, 'mycollection')]
        ];

        for (const [sync, generated] of cases) {
            expect(generated).to.deep.equal(sync.map((action) => ({...action, authorization})));
        }
    });

    it('builder delattrroy forwards uint64 rule_id strings verbatim', () => {
        const actions = builder.delattrroy('mycollection', '18446744073709551615');

        expect(actions[0].data.rule_id).to.equal('18446744073709551615');
    });
});

describe('AtomicMarketActions action-name constants', () => {
    it('every entry maps an action name to itself', () => {
        for (const [key, value] of Object.entries(AtomicMarketActions)) {
            expect(value).to.equal(key);
        }
    });

    it('includes the v2 royalty and template-buyoffer action names from the ABI', () => {
        const expected = [
            'setroyalconf', 'settemplroy', 'setattrroy', 'deltemplroy', 'delattrroy', 'delroyalconf',
            'createtbuyo', 'canceltbuyo', 'fulfilltbuyo', 'lognewtbuyo',
            'announcesale', 'purchasesale', 'auctionbid', 'createbuyo'
        ];

        for (const name of expected) {
            expect(AtomicMarketActions).to.have.property(name, name);
        }
    });

    it('is what the generator methods actually emit', async () => {
        const authorization: EosioAuthorizationObject[] = [{actor: 'creator', permission: 'active'}];
        const generator = new MarketActionGenerator('atomicmarket');
        const [action] = await generator.delroyalconf(authorization, 'mycollection');

        expect(action.name).to.equal(AtomicMarketActions.delroyalconf);
    });
});
