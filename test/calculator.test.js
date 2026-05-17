const assert = require('node:assert/strict');
const test = require('node:test');
const Calculator = require('../calculator');

const baseInput = {
  fabricWidth: 100,
  fabricLength: 100,
  pieceWidth: 30,
  pieceLength: 30,
  margin: 0,
  spacing: 5,
  desiredQuantity: 7,
  fabricPrice: 0,
  boughtLength: 0,
  allowRotate: true
};

test('calculateFitCount applies spacing only between pieces', () => {
  assert.equal(Calculator.calculateFitCount(100, 30, 5), 3);
  assert.equal(Calculator.calculateOccupiedLength(3, 30, 5), 100);
});

test('calculateHaveFabric returns piece and row totals for available fabric', () => {
  const result = Calculator.calculateHaveFabric(baseInput);

  assert.equal(result.piecesAcross, 3);
  assert.equal(result.rowsInLength, 3);
  assert.equal(result.totalPieces, 9);
  assert.equal(result.usedLength, 100);
  assert.equal(result.remainingLength, 0);
});

test('calculateBuyFabric returns needed rows and length for desired quantity', () => {
  const result = Calculator.calculateBuyFabric(baseInput);

  assert.equal(result.piecesAcross, 3);
  assert.equal(result.rowsNeeded, 3);
  assert.equal(result.neededLength, 100);
});

test('chooseBestOrientation can rotate to fit more pieces', () => {
  const result = Calculator.calculateHaveFabric({
    ...baseInput,
    fabricWidth: 70,
    fabricLength: 100,
    pieceWidth: 50,
    pieceLength: 20,
    spacing: 0,
    allowRotate: true
  });

  assert.equal(result.rotated, true);
  assert.equal(result.totalPieces, 6);
});

test('calculatePricePerMeter ignores incomplete price data', () => {
  assert.equal(Calculator.calculatePricePerMeter({ fabricPrice: 45, boughtLength: 0 }), 0);
  assert.equal(Calculator.calculatePricePerMeter({ fabricPrice: 45, boughtLength: 150 }), 30);
});
