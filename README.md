# Calculadora de Corte para Costureiras

Aplicação web simples para ajudar costureiras a calcular o aproveitamento de tecido em cortes retangulares. O projeto permite descobrir quantas peças cabem em um tecido disponível ou estimar quanto tecido comprar para uma quantidade desejada.

## Funcionalidades

- Calcula quantas peças cabem em um tecido já disponível.
- Calcula o comprimento aproximado de tecido necessário para uma quantidade desejada de peças.
- Sugere a compra arredondada para cima em múltiplos de 10 cm.
- Permite informar margem de costura e espaço entre peças.
- Permite girar a peça para tentar aproveitar melhor a largura do tecido.
- Oferece botões com larguras comuns de tecido.
- Calcula custo por metro linear, custo por peça e custo estimado da produção quando o preço do tecido é informado.
- Permite informar o preço por metro diretamente ou calcular esse valor a partir do preço pago e comprimento comprado.
- Gera um resumo do cálculo em formato simples para copiar e enviar pelo WhatsApp.
- Exibe uma visualização gráfica simples do encaixe das peças no tecido.
- Compara larguras comuns de tecido no modo de compra e destaca o melhor aproveitamento.
- Possui layout responsivo para desktop e celular.

## Como abrir o projeto

Este projeto não precisa de instalação nem de dependências externas. Basta abrir o arquivo `index.html` em um navegador.

### Opção 1: abrir diretamente

1. Baixe ou clone este repositório.
2. Abra o arquivo `index.html` com seu navegador.

### Opção 2: usar um servidor local simples

Se você tiver Python instalado, rode o comando abaixo na pasta do projeto:

```bash
python3 -m http.server 8000
```

Depois acesse:

```text
http://localhost:8000
```

## Como testar

Rode os testes unitários da lógica de cálculo com:

```bash
npm test
```

## Como usar

### Modo "Tenho tecido"

Use este modo quando você já tem uma metragem de tecido e quer saber quantas peças consegue cortar.

1. Informe a largura do tecido em centímetros.
2. Informe o comprimento disponível em centímetros.
3. Informe a largura e o comprimento de cada peça.
4. Informe a margem de costura e o espaço entre peças.
5. Escolha se a calculadora pode girar a peça.
6. Clique em **Calcular** ou altere qualquer campo para recalcular automaticamente.

### Modo "Quero calcular compra"

Use este modo quando você quer produzir uma quantidade específica de peças e precisa estimar quanto tecido comprar.

1. Informe a largura do tecido em centímetros.
2. Informe a largura e o comprimento de cada peça.
3. Informe a quantidade desejada.
4. Informe margem, espaçamento e rotação, se necessário.
5. Consulte o comprimento necessário, a sugestão de compra arredondada e a comparação entre larguras comuns de tecido.

## Campos de custo opcionais

A seção de custo é opcional. Para calcular custo por peça ou custo total estimado, você pode usar uma das opções:

- **Preço por metro linear em R$**: use quando você já sabe o valor de 1 metro do tecido. Este campo tem prioridade nos cálculos.
- **Preço pago pelo tecido em R$** e **comprimento comprado em cm**: use quando você quer que a calculadora descubra o preço por metro linear a partir da compra feita.

Com esses dados, a calculadora usa o preço por metro linear nos custos por peça e na estimativa total de produção.

## Estrutura atual

```text
.
├── calculator.js
├── index.html
├── package.json
├── README.md
├── script.js
├── style.css
└── test/
    ├── browser-load.test.js
    └── calculator.test.js
```

O arquivo `index.html` contém a estrutura da página, `style.css` concentra os estilos visuais, `script.js` controla a interface e `calculator.js` concentra a lógica de cálculo testável.

## Regras gerais do cálculo

- Todas as medidas devem ser informadas em centímetros.
- O cálculo principal considera cortes retangulares organizados em linhas e colunas.
- A margem de costura é aplicada nos dois lados da largura e nos dois lados do comprimento da peça.
- O espaçamento informado é aplicado somente entre peças e entre fileiras, sem adicionar espaço extra após a última peça da linha ou a última fileira.
- Quando a opção de rotação está ativa, a calculadora compara a peça em posição normal e girada, escolhendo o melhor aproveitamento encontrado.
- A sugestão de compra arredonda o comprimento necessário para cima em múltiplos de 10 cm.
- A comparação de larguras usa 115, 120, 140, 150, 160, 180, 250 e 300 cm; a melhor opção é a de menor comprimento necessário e, em caso de empate, maior quantidade de peças por faixa.

## Próximos passos sugeridos

- Melhorar a validação de valores monetários com formato brasileiro.

## Licença

Ainda não há uma licença definida para este projeto.
