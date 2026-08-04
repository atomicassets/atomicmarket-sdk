import { execFileSync } from 'child_process';
import { expect } from 'chai';

interface PackReport {
    files: Array<{path: string}>;
}

// Returns the balanced JSON value opening at `start`, or '' if it never closes.
function balancedValueAt(stream: string, start: number): string {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < stream.length; index++) {
        const character = stream[index];

        if (escaped) {
            escaped = false;
        } else if (inString) {
            if (character === '\\') {
                escaped = true;
            } else if (character === '"') {
                inString = false;
            }
        } else if (character === '"') {
            inString = true;
        } else if (character === '[' || character === '{') {
            depth++;
        } else if (character === ']' || character === '}') {
            depth--;

            if (depth === 0) {
                return stream.slice(start, index + 1);
            }
        }
    }

    return '';
}

// Neither the report's position in the stream nor its shape can be assumed.
// Build banners share stdout and print JSON of their own, so the first value is
// not necessarily the report; and the shape is npm-version dependent, an array
// of report objects up to npm 11 and an object keyed by package name from npm
// 12. CI runs the Node image's npm while the publish job upgrades to the latest
// for trusted publishing, so this test meets both shapes. Identify the report
// by the only thing stable across them, a member carrying a `files` list.
function readPackReport(stream: string): PackReport {
    for (let start = 0; start < stream.length; start++) {
        if (stream[start] !== '[' && stream[start] !== '{') {
            continue;
        }

        const json = balancedValueAt(stream, start);

        if (!json) {
            continue;
        }

        let parsed: unknown;

        try {
            parsed = JSON.parse(json);
        } catch {
            // Balanced but not JSON, so the report may still be nested inside it.
            // Keep scanning from the next character rather than skipping the span.
            continue;
        }

        const members = Array.isArray(parsed) ? parsed : Object.values(parsed as object);
        const report = members.find((member) => Array.isArray((member as PackReport)?.files));

        if (report) {
            return report as PackReport;
        }

        // A complete JSON value that is not the report, such as a build banner's
        // own object. Resume after it instead of walking every bracket it
        // contains, which would make the scan quadratic on a long file list.
        start += json.length - 1;
    }

    throw new Error(`npm pack emitted no report carrying a file list: ${stream}`);
}

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

    it('the built package exposes the delphi settlement utilities as functions', () => {
        const built = require('../build/index.cjs');

        expect(built.deriveSettlementAmount).to.be.a('function');
        expect(built.formatQuantity).to.be.a('function');
    });

    it('declares exactly one runtime dependency, the sibling atomicassets SDK', () => {
        const manifest = require('../package.json');

        expect(Object.keys(manifest.dependencies)).to.deep.equal(['@atomichub/atomicassets']);
    });

    it('reads the array-shaped pack report npm 11 and earlier emit', () => {
        const stream = '[\n  {\n    "files": [{"path": "package.json"}],\n    "bundled": []\n  }\n]\n';

        expect(readPackReport(stream).files.map((f) => f.path)).to.deep.equal(['package.json']);
    });

    it('reads the object-shaped pack report npm 12 emits', () => {
        const stream = '{\n  "@scope/name": {\n    "files": [{"path": "package.json"}],\n    "bundled": []\n  }\n}\n';

        expect(readPackReport(stream).files.map((f) => f.path)).to.deep.equal(['package.json']);
    });

    it('skips bracketed notices and a build banner printing JSON of its own', () => {
        const report = '[{"files": [{"path": "package.json"}], "bundled": []}]';
        const stream = `npm warn config [ignored]\nCLI Building entry: {"index":"src/index.ts"}\n${report}\nnpm notice publishing [@scope/name@1.0.0]\n`;

        expect(readPackReport(stream).files.map((f) => f.path)).to.deep.equal(['package.json']);
    });

    it('npm pack --dry-run includes build/ and the .d.ts, and excludes src/', function () {
        this.timeout(30000);

        const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {cwd: __dirname + '/..'}).toString();
        const files: string[] = readPackReport(output).files.map((f) => f.path);

        expect(files.some((f) => f.startsWith('build/'))).to.equal(true);
        expect(files.some((f) => f === 'build/index.d.ts')).to.equal(true);
        expect(files.some((f) => f.startsWith('src/'))).to.equal(false);
    });
});
