(function initCalculator(root, factory) {
  const Calculator = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Calculator;
  }

  if (root) {
    root.Calculator = Calculator;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createCalculator() {
  function getFinalPieceSize(width, length, margin) {
    return {
      finalWidth: width + margin * 2,
      finalLength: length + margin * 2
    };
  }

  function calculateFitCount(availableLength, itemLength, spacing) {
    if (availableLength < itemLength) return 0;
    return Math.floor((availableLength + spacing) / (itemLength + spacing));
  }

  function calculateOccupiedLength(itemCount, itemLength, spacing) {
    if (itemCount <= 0) return 0;
    return itemCount * itemLength + (itemCount - 1) * spacing;
  }

  function calculatePricePerMeter(input) {
    if (input.fabricPrice <= 0 || input.boughtLength <= 0) return 0;
    return input.fabricPrice / (input.boughtLength / 100);
  }

  function calculateOrientation(input, rotated, mode) {
    const baseWidth = rotated ? input.pieceLength : input.pieceWidth;
    const baseLength = rotated ? input.pieceWidth : input.pieceLength;
    const size = getFinalPieceSize(baseWidth, baseLength, input.margin);
    const piecesAcross = calculateFitCount(input.fabricWidth, size.finalWidth, input.spacing);
    const rowsInLength = mode === 'have'
      ? calculateFitCount(input.fabricLength, size.finalLength, input.spacing)
      : 0;
    const totalPieces = piecesAcross * rowsInLength;
    const rowsNeeded = piecesAcross > 0 ? Math.ceil(input.desiredQuantity / piecesAcross) : 0;
    const neededLength = calculateOccupiedLength(rowsNeeded, size.finalLength, input.spacing);

    return {
      rotated,
      finalWidth: size.finalWidth,
      finalLength: size.finalLength,
      piecesAcross,
      rowsInLength,
      totalPieces,
      rowsNeeded,
      neededLength
    };
  }

  function chooseBestOrientation(input, mode) {
    const normal = calculateOrientation(input, false, mode);
    if (!input.allowRotate) return normal;

    const rotated = calculateOrientation(input, true, mode);

    if (mode === 'have') {
      if (rotated.totalPieces > normal.totalPieces) return rotated;
      return normal;
    }

    if (normal.piecesAcross <= 0 && rotated.piecesAcross > 0) return rotated;
    if (rotated.piecesAcross <= 0 && normal.piecesAcross > 0) return normal;
    if (rotated.neededLength > 0 && rotated.neededLength < normal.neededLength) return rotated;
    return normal;
  }

  function calculateHaveFabric(input) {
    const best = chooseBestOrientation(input, 'have');
    const pricePerMeter = calculatePricePerMeter(input);
    const usedLength = calculateOccupiedLength(best.rowsInLength, best.finalLength, input.spacing);
    const remainingLength = input.fabricLength - usedLength;
    const costPerPiece = pricePerMeter > 0 && best.totalPieces > 0
      ? pricePerMeter * ((usedLength / Math.max(best.totalPieces, 1)) / 100)
      : 0;

    const alerts = [];
    if (best.piecesAcross <= 0) {
      alerts.push({ type: 'danger', text: 'Essa peça não cabe na largura informada do tecido. Tente girar a peça ou escolher um tecido mais largo.' });
    } else if (best.totalPieces <= 0) {
      alerts.push({ type: 'danger', text: 'Nenhuma peça cabe com essas medidas. Verifique a largura do tecido, a margem e o espaçamento.' });
    } else {
      alerts.push({ type: 'success', text: `Melhor encaixe encontrado: peça ${best.rotated ? 'girada' : 'na posição normal'}.` });
    }

    return {
      ...best,
      pricePerMeter,
      usedLength,
      remainingLength,
      costPerPiece,
      alerts
    };
  }

  function calculateBuyFabric(input) {
    const best = chooseBestOrientation(input, 'buy');
    const pricePerMeter = calculatePricePerMeter(input);
    const lengthPerPiece = best.neededLength / input.desiredQuantity;
    const costPerPiece = pricePerMeter > 0 ? pricePerMeter * (lengthPerPiece / 100) : 0;
    const totalCost = costPerPiece * input.desiredQuantity;

    const alerts = [];
    if (best.piecesAcross <= 0) {
      alerts.push({ type: 'danger', text: 'Essa peça não cabe na largura informada do tecido. Tente girar a peça ou escolher um tecido mais largo.' });
    } else {
      alerts.push({ type: 'success', text: `Melhor encaixe encontrado: peça ${best.rotated ? 'girada' : 'na posição normal'}.` });
    }

    return {
      ...best,
      pricePerMeter,
      lengthPerPiece,
      costPerPiece,
      totalCost,
      alerts
    };
  }

  const Calculator = {
    getFinalPieceSize,
    calculateFitCount,
    calculateOccupiedLength,
    calculatePricePerMeter,
    calculateOrientation,
    chooseBestOrientation,
    calculateHaveFabric,
    calculateBuyFabric
  };

  return Calculator;
}));
