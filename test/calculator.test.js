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

test('calculateBuyFabric suggests purchase rounded up to 10 cm', () => {
  const result = Calculator.calculateBuyFabric({
    ...baseInput,
    fabricWidth: 150,
    pieceWidth: 20,
    pieceLength: 30,
    margin: 1,
    spacing: 1,
    desiredQuantity: 50
  });

  assert.equal(result.neededLength, 296);
  assert.equal(result.suggestedLength, 300);
});

test('calculatePricePerMeter prioritizes direct meter price', () => {
  assert.equal(Calculator.calculatePricePerMeter({
    pricePerMeter: 22.5,
    fabricPrice: 45,
    boughtLength: 200
  }), 22.5);
});

test('compareFabricWidths marks best option and not-fitting widths', () => {
  const result = Calculator.compareFabricWidths({
    ...baseInput,
    pieceWidth: 130,
    pieceLength: 20,
    desiredQuantity: 10,
    spacing: 0,
    allowRotate: false
  }, [120, 140, 300]);

  assert.equal(result[0].fits, false);
  assert.equal(result[0].piecesAcross, 0);
  assert.equal(result[1].fits, true);
  assert.equal(result[2].fits, true);
  assert.equal(result[2].isBest, true);
});
