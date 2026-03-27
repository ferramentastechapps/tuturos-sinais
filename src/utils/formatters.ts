export const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return '$0.00';
    
    // Configura precisão baseada no valor da moeda (ex: moedas baratas precisam de muitas casas)
    let maxDec = 2;
    let minDec = 2;
    
    if (value < 0.0001) { maxDec = 8; minDec = 6; }
    else if (value < 0.1) { maxDec = 6; minDec = 4; }
    else if (value < 1) { maxDec = 5; minDec = 4; }
    else if (value < 100) { maxDec = 4; minDec = 2; }

    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: minDec,
        maximumFractionDigits: maxDec
    });
};

export const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
};

export const formatNumber = (value: number, decimals = 2) => {
    return value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
};
