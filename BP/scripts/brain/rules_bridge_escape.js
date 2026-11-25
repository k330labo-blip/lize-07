// 溶岩海の足場脱出 (ENV-02 cycle0340)（優先度帯 920〜922、emergency2 の溶岩帯 916〜919 の直上）
// 前提文脈: c.x.selfInLava / shoreDist / shoreDir / hasBlocks / escapeBlockCount /
//           escapeBlockId / shoreNeed / hasWaterBucket / fireResActive
// 知覚供給・実行部 (place_block_escape)・出口 (lavaStuck) と同版統合 (分割統合は
// 供給なき条件で発動0回になるため禁止。cycle2036-a10 DRAFT_FIX が正)。
// 耐火ポーション項には依存しない: hasFireResPotion は正式版 API で種別判別ができず
// false 固定 (dormant) のため、飲用連鎖を足場脱出の前提にしない。
export const RULES = [
{id:'env02_bridge_critical',p:922,when:c=>Boolean(c.x?.selfInLava&&c.self.hpPct<=0.5&&(c.x?.shoreDist??999)>=8&&(c.x?.shoreDist??999)<=32&&c.x?.hasBlocks&&(c.x?.escapeBlockCount??0)>=(c.x?.shoreNeed??999)),act:'place_block_escape',say:'岸がありません。足場を作って出ます',note:'ENV-02本命(HP圧迫版): 岸なし圏+必要数以上の不燃ブロック所持'},
{id:'env02_bridge_escape',p:921,when:c=>Boolean(c.x?.selfInLava&&(c.x?.shoreDist??999)>=8&&(c.x?.shoreDist??999)<=32&&c.x?.hasBlocks&&(c.x?.escapeBlockCount??0)>=(c.x?.shoreNeed??999)),act:'place_block_escape',say:'岸が見えませんね。……ブロックはあります。足場を作ります',note:'ENV-02本命: HPに余裕がある版。発話は「出られます」と断定せず材料の事実を言う'},
{id:'env02_bridge_short_warn',p:920.6,when:c=>Boolean(c.x?.selfInLava&&typeof c.x?.shoreDist==="number"&&(c.x?.shoreDist??999)>=8&&c.x?.hasBlocks&&(c.x?.escapeBlockCount??0)<(c.x?.shoreNeed??999)&&c.flags.warnOk),act:'escape_hazard',say:'足場の材料が足りません。あと少しあれば届くのですが',note:'不足時は橋を始めない。中途半端に始めて真ん中で尽きるのが最悪のため、移動は従来前進に委ね不足の事実だけ申告する'},
{id:'env02_hopeless_declare',p:920.4,when:c=>Boolean(c.x?.selfInLava&&typeof c.x?.shoreDist==="number"&&(c.x?.shoreDist??999)>=8&&!c.x?.hasBlocks&&!c.x?.hasWaterBucket&&c.flags.warnOk),act:'say_only',say:'岸がなく、足場の材料もありません。……ブロックを投げてもらえれば、出られます',note:'発話チャンネル専用。助かる前提の嘘を言わず、救助の具体的な方法(ブロック投げ渡し)を提示する'},
{id:'env02_hopeless_wait',p:920.2,when:c=>Boolean(c.x?.selfInLava&&typeof c.x?.shoreDist==="number"&&(c.x?.shoreDist??999)>=8&&!c.x?.hasBlocks),act:'escape_hazard',say:null,note:'移動チャンネル: 申告と対で従来の hopeless 前進を維持する。ブロックが渡されれば次サイクルで env02_bridge_* が自然に上書きする'},
];
