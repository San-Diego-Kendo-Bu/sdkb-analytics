export function rankToNum(num, type) {
    if(type === "shihan") return 10;
    if(type === "dan") return num;
    if(num === 0) return -10;
    return -1 * num;
}

export function compareRank(a, b) {
    const aNum = rankToNum(a['rank_number'], a['rank_type']);
    const bNum = rankToNum(b['rank_number'], b['rank_type']);
    if(aNum > bNum) return -1; // higher rank, comes first
    if(aNum === bNum) return 0; // equal rank
    return 1; // lower rank, comes second
}

export function formatName(first, last) {
    const firstInitial = first?.[0]?.toUpperCase() || '';
    const lastName = (last || '').toUpperCase();
    return `${firstInitial}.${lastName}`;
}

export function formatRank(num, type) {
    if(type === 'shihan') return 'DOJO SHIHAN';
    return `${num} ${type.toUpperCase()}`;
}

export function rankToKanji(num, type) {
    if(type === 'shihan') return '師範';
    
    // testing
    var nums;
    if(type === 'dan') nums = ['無','初','弐','参','四','五','六','七','八'];
    else nums = ['無','一','二','三','四','五','六','七','八'];
    const types = {'kyu':'級','dan':'段'};

    return `${nums[num]}${types[type]}`;
}