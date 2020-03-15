import BigNumber from 'bignumber.js';

export function newBigDecimal(n) {
	requireArgCount(arguments, 1, 1);
	return new BigDecimal(n);
}

export class BigDecimal {
	constructor(num) {
		if (!(num instanceof BigNumber) || num.isNaN() || !num.isFinite()) {
			throw new Error(`Cannot create BigDecimal from ${humanReadable(num)}`);
		}
		this.num = num;
	}
	setScale(scale, roundingMode) {
		requireArgCount(arguments, 2, 2);
		let scaled = new BigDecimal(this.num.decimalPlaces(toInt(scale), toInt(roundingMode)));
		//console.log('scale', toInt(scale), toInt(roundingMode), scaled.toString());
		return scaled;
	}
	add(n) {
		requireArgCount(arguments, 1, 1);
		requireBigDecimal(n);
		return new BigDecimal(this.num.plus(n.num));
	}
	subtract(n) {
		requireArgCount(arguments, 1, 1);
		requireBigDecimal(n);
		return new BigDecimal(this.num.minus(n.num));
	}
	multiply(n) {
		requireArgCount(arguments, 1, 1);
		requireBigDecimal(n);
		return new BigDecimal(this.num.times(n.num));
	}
	divide(n, scale, roundingMode) {
		requireArgCount(arguments, 1, 3);
		requireBigDecimal(n);
		let scaleFn = arguments.length > 1 ? n => n.setScale(scale, roundingMode) : n => n;
		return new BigDecimal(scaleFn(this).num.div(scaleFn(n).num));
	}
	compareTo(n) {
		requireArgCount(arguments, 1, 1);
		requireBigDecimal(n);
		return new BigNumber(this.num.comparedTo(n.num));
	}
	longValue() {
		return this.num.decimalPlaces(0, BigNumber.ROUND_DOWN);
	}
	toString() {
		requireArgCount(arguments, 0, 0);
		return this.num.toFixed();
	}
}

function requireBigDecimal(v) {
	if (!(v instanceof BigDecimal) || v.num.isNaN() || !v.num.isFinite()) {
		throw new Error(`No valid BigDecimal provided but ${humanReadable(v)}`);
	}
}

function requireArgCount(args, min, max) {
	if (args.length < min || args.length > max) {
		throw new Error(`Expected ${min}/${max} arguments but received ${args.length}`);
	}
}

function toInt(num) {
	let i = num.integerValue().toFixed();
	if (num.toFixed() !== i) {
		throw new Error(`Cannot convert ${humanReadable(num)} to int`);
	}
	return parseInt(i);
}

function humanReadable(v) {
	return v === null ? 'null' : `${v.constructor.name}(${v})`;
}
