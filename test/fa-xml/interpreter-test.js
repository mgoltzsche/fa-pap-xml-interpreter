import load from '../../src/fa-xml/loader.js';
import fs from 'fs';
import assert from 'assert';

describe('FA XML Interpreter', function() {
	describe('load(xmlStr)', function() {
		it('load', function() {
			let Lohnsteuer2020 = fs.readFileSync('src/codes/Lohnsteuer2020.xml.xhtml', 'utf8');
			let pap = load(Lohnsteuer2020);
			assert(pap);
			let actual = pap.evaluate({});
			assert(actual);
		});
	});
});
