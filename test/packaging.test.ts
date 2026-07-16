import { execFileSync } from 'child_process';
import { expect } from 'chai';

describe('packaging / build-artifact resolution', () => {
    it('the built package resolves under require() and exposes AtomicMarketApi, market types, enums (as runtime values), and MarketActionGenerator from the root', () => {
        const built = require('../build/index.cjs');

        expect(built.AtomicMarketApi).to.be.a('function');
        expect(built.MarketActionGenerator).to.be.a('function');
        expect(built.MarketActionBuilder).to.be.a('function');
        expect(built.AtomicMarketActions).to.deep.include({setroyalconf: 'setroyalconf', delattrroy: 'delattrroy'});
        expect(built.ApiError).to.be.a('function');
        expect(built.AuctionState).to.deep.include({Waiting: 0, Listed: 1, Canceled: 2, Sold: 3, Invalid: 4});
        expect(built.SaleState).to.be.an('object');
        expect(built.BuyofferState).to.be.an('object');
        expect(built.SortOrder).to.deep.include({Asc: 'asc', Desc: 'desc'});
    });

    it('npm pack --dry-run includes build/ and the .d.ts, and excludes src/', function () {
        this.timeout(30000);

        const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {cwd: __dirname + '/..'}).toString();
        // npm pack --json prints a single JSON array of objects; banner or warning
        // text on stdout can itself contain '[', so anchor on the array-of-objects
        // opening rather than the first bracket.
        const jsonMatch = output.match(/\[\s*\{[\s\S]*\]/);

        if (!jsonMatch) {
            throw new Error(`npm pack emitted no JSON array: ${output}`);
        }

        const [result] = JSON.parse(jsonMatch[0]);
        const files: string[] = result.files.map((f: {path: string}) => f.path);

        expect(files.some((f) => f.startsWith('build/'))).to.equal(true);
        expect(files.some((f) => f === 'build/index.d.ts')).to.equal(true);
        expect(files.some((f) => f.startsWith('src/'))).to.equal(false);
    });
});
