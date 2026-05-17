let currentMode = 'have';
let lastSummary = '';

const tabs = document.querySelectorAll('.tab');
const form = document.querySelector('#calculatorForm');
const quantityGroup = document.querySelector('#quantityGroup');
const fabricLengthGroup = document.querySelector('#fabricLengthGroup');
const resultsEl = document.querySelector('#results');
const alertsEl = document.querySelector('#alerts');
const summaryEl = document.querySelector('#summary');
const copyButton = document.querySelector('#copyButton');
const clearButton = document.querySelector('#clearButton');

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

function getNumber(id) {
  const value = Number(document.querySelector(id).value.replace?.(',', '.') || document.querySelector(id).value);
  return Number.isFinite(value) ? value : 0;
}

function formatCm(value) {
  return `${round(value)} cm`;
}

function formatMeters(valueCm) {
  return `${round(valueCm / 100)} m`;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function getInputs() {
  return {
    fabricWidth: getNumber('#fabricWidth'),
    fabricLength: getNumber('#fabricLength'),
    pieceWidth: getNumber('#pieceWidth'),
    pieceLength: getNumber('#pieceLength'),
    margin: getNumber('#margin'),
    spacing: getNumber('#spacing'),
    desiredQuantity: Math.max(1, Math.floor(getNumber('#desiredQuantity'))),
    fabricPrice: getNumber('#fabricPrice'),
    boughtLength: getNumber('#boughtLength'),
    allowRotate: document.querySelector('#allowRotate').checked
  };
}

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

function calculateOrientation(input, rotated) {
  const baseWidth = rotated ? input.pieceLength : input.pieceWidth;
  const baseLength = rotated ? input.pieceWidth : input.pieceLength;
  const size = getFinalPieceSize(baseWidth, baseLength, input.margin);
  const piecesAcross = calculateFitCount(input.fabricWidth, size.finalWidth, input.spacing);
  const rowsInLength = currentMode === 'have'
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

function chooseBestOrientation(input) {
  const normal = calculateOrientation(input, false);
  if (!input.allowRotate) return normal;

  const rotated = calculateOrientation(input, true);

  if (currentMode === 'have') {
    if (rotated.totalPieces > normal.totalPieces) return rotated;
    return normal;
  }

  if (normal.piecesAcross <= 0 && rotated.piecesAcross > 0) return rotated;
  if (rotated.piecesAcross <= 0 && normal.piecesAcross > 0) return normal;
  if (rotated.neededLength > 0 && rotated.neededLength < normal.neededLength) return rotated;
  return normal;
}

function calculateHaveFabric(input) {
  const best = chooseBestOrientation(input);
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
  const best = chooseBestOrientation(input);
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

function renderResultItem(value, label) {
  return `
    <div class="result-item">
      <strong>${value}</strong>
      <span>${label}</span>
    </div>
  `;
}

function renderAlerts(alerts) {
  alertsEl.innerHTML = alerts.map(alert => `
    <div class="alert ${alert.type}">${alert.text}</div>
  `).join('');
}

function renderHaveResults(input, result) {
  const costItems = result.pricePerMeter > 0 ? [
    renderResultItem(moneyFormatter.format(result.pricePerMeter), 'Custo por metro linear'),
    renderResultItem(moneyFormatter.format(result.costPerPiece), 'Custo estimado por peça')
  ].join('') : '';

  resultsEl.innerHTML = [
    renderResultItem(result.totalPieces, 'Peças que cabem'),
    renderResultItem(result.piecesAcross, 'Peças por faixa/largura'),
    renderResultItem(result.rowsInLength, 'Fileiras no comprimento'),
    renderResultItem(formatCm(result.usedLength), 'Comprimento usado'),
    renderResultItem(formatCm(Math.max(result.remainingLength, 0)), 'Comprimento restante'),
    costItems
  ].join('');

  lastSummary = `Resumo do corte\n\n` +
    `Largura do tecido: ${formatCm(input.fabricWidth)}\n` +
    `Comprimento disponível: ${formatCm(input.fabricLength)}\n` +
    `Medida da peça: ${formatCm(input.pieceWidth)} x ${formatCm(input.pieceLength)}\n` +
    `Margem: ${formatCm(input.margin)}\n` +
    `Espaçamento: ${formatCm(input.spacing)}\n` +
    `Posição usada: ${result.rotated ? 'peça girada' : 'peça normal'}\n\n` +
    `Resultado:\n` +
    `Cabem ${result.totalPieces} peças no tecido.\n` +
    `Peças por faixa: ${result.piecesAcross}\n` +
    `Fileiras: ${result.rowsInLength}\n` +
    `Comprimento usado: ${formatCm(result.usedLength)} (${formatMeters(result.usedLength)})\n` +
    `Sobra de tecido: ${formatCm(Math.max(result.remainingLength, 0))}\n` +
    (result.pricePerMeter > 0 ? `Custo estimado por peça: ${moneyFormatter.format(result.costPerPiece)}\n` : '');
}

function renderBuyResults(input, result) {
  const costItems = result.pricePerMeter > 0 ? [
    renderResultItem(moneyFormatter.format(result.pricePerMeter), 'Custo por metro linear'),
    renderResultItem(moneyFormatter.format(result.costPerPiece), 'Custo estimado por peça'),
    renderResultItem(moneyFormatter.format(result.totalCost), 'Custo estimado da produção')
  ].join('') : '';

  resultsEl.innerHTML = [
    renderResultItem(formatCm(result.neededLength), 'Comprimento necessário'),
    renderResultItem(formatMeters(result.neededLength), 'Comprar em metros'),
    renderResultItem(result.piecesAcross, 'Peças por faixa/largura'),
    renderResultItem(result.rowsNeeded, 'Fileiras necessárias'),
    costItems
  ].join('');

  lastSummary = `Resumo da compra\n\n` +
    `Largura do tecido: ${formatCm(input.fabricWidth)}\n` +
    `Medida da peça: ${formatCm(input.pieceWidth)} x ${formatCm(input.pieceLength)}\n` +
    `Quantidade desejada: ${input.desiredQuantity} peças\n` +
    `Margem: ${formatCm(input.margin)}\n` +
    `Espaçamento: ${formatCm(input.spacing)}\n` +
    `Posição usada: ${result.rotated ? 'peça girada' : 'peça normal'}\n\n` +
    `Resultado:\n` +
    `Você precisa comprar aproximadamente ${formatMeters(result.neededLength)} de tecido.\n` +
    `Comprimento em cm: ${formatCm(result.neededLength)}\n` +
    `Peças por faixa: ${result.piecesAcross}\n` +
    `Fileiras necessárias: ${result.rowsNeeded}\n` +
    (result.pricePerMeter > 0 ? `Custo estimado da produção: ${moneyFormatter.format(result.totalCost)}\n` : '');
}

function validateInputs(input) {
  const errors = [];

  if (input.fabricWidth <= 0) errors.push('Informe a largura do tecido.');
  if (currentMode === 'have' && input.fabricLength <= 0) errors.push('Informe o comprimento disponível do tecido.');
  if (input.pieceWidth <= 0) errors.push('Informe a largura da peça.');
  if (input.pieceLength <= 0) errors.push('Informe o comprimento da peça.');
  if (input.margin < 0) errors.push('Informe uma margem de costura igual ou maior que zero.');
  if (input.spacing < 0) errors.push('Informe um espaço entre peças igual ou maior que zero.');
  if (currentMode === 'buy' && input.desiredQuantity <= 0) errors.push('Informe a quantidade desejada.');

  return errors;
}

function calculate() {
  const input = getInputs();
  const errors = validateInputs(input);

  if (errors.length > 0) {
    renderAlerts(errors.map(text => ({ type: 'danger', text })));
    resultsEl.innerHTML = '';
    summaryEl.textContent = 'Corrija as medidas para calcular.';
    copyButton.classList.add('hidden');
    return;
  }

  if (currentMode === 'have') {
    const result = calculateHaveFabric(input);
    renderAlerts(result.alerts);
    renderHaveResults(input, result);
  } else {
    const result = calculateBuyFabric(input);
    renderAlerts(result.alerts);
    renderBuyResults(input, result);
  }

  summaryEl.textContent = lastSummary;
  copyButton.classList.remove('hidden');
}

function setMode(mode) {
  currentMode = mode;
  tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.mode === mode));
  quantityGroup.classList.toggle('hidden', mode !== 'buy');
  fabricLengthGroup.classList.toggle('hidden', mode !== 'have');
  calculate();
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => setMode(tab.dataset.mode));
});

document.querySelectorAll('.preset-btn').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelector('#fabricWidth').value = button.dataset.width;
    calculate();
  });
});

form.addEventListener('submit', event => {
  event.preventDefault();
  calculate();
});

form.addEventListener('input', () => {
  calculate();
});

clearButton.addEventListener('click', () => {
  form.reset();
  document.querySelector('#fabricWidth').value = 150;
  document.querySelector('#fabricLength').value = 200;
  document.querySelector('#pieceWidth').value = 20;
  document.querySelector('#pieceLength').value = 30;
  document.querySelector('#margin').value = 1;
  document.querySelector('#spacing').value = 1;
  document.querySelector('#desiredQuantity').value = 50;
  document.querySelector('#allowRotate').checked = true;
  calculate();
});

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(lastSummary);
    copyButton.textContent = 'Resumo copiado!';
    setTimeout(() => {
      copyButton.textContent = 'Copiar resumo';
    }, 1800);
  } catch (error) {
    alert('Não foi possível copiar automaticamente. Selecione o resumo e copie manualmente.');
  }
});

calculate();
