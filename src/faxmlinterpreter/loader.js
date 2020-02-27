import xml2js from 'xml2js';
import BigNumber from 'bignumber.js';
import {parse} from '../expression/parser.js';
import evaluate from '../expression/interpreter.js';

export default function load(xmlstr, success, error) {
	let xmlParser = xml2js.Parser();
	xmlParser.parseString(xmlstr, function(err, result) {
		if (err) {
			error(err);
		} else {
			success(build(result));
		}
	});
}

function build(obj) {
	let pap = obj.PAP;
	if (!pap) {
		throw new Error('No PAP XML provided');
	}
	let constants = {}
	for (let c of pap.CONSTANTS[0].CONSTANT) {
		let expr = parse(c.$.value);
		constants[c.$.name] = evaluate(expr, newScope());
		//console.log(c.$.name, c.$.type, c.$.value, constants[c.$.name]);
	}
	return new PAP(constants);
}

class PAP {
	constructor(constants) {
		this.constants = constants;
	}
}

class BigDecimal {
	constructor(num) {
		this.num = num;
	}
	toString() {
		return this.num.toString();
	}
}

function newScope() {
	return {
		BigDecimal: {
			construct: function(n) {
				return new BigDecimal(n);
			},
			ONE: new BigDecimal(new BigNumber(0))
		}
	};
}
