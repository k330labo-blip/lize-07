// knowledge_world.js — リゼ (LIZE-07) の「世界の仕組み」知識ベース
// 純粋JS。mc_knowledge.js と同形式・同検索方式。topic は全件 "world"。
// 方針: 時点に依存しない安定知識のみ。時点依存の事実は answer 内に「私の記録では（2026年時点）」と明記したものに限定。
// 戦争・紛争の最新状況など変動の激しい断言は入れない（最新系は world_honesty.js が担当）。
// 口調: LIZE_SETTING.md 準拠（私／あなた、短い敬語、基本クール）。政治的中立を守る。
export const KNOWLEDGE_WORLD = [
// ===== 国際機関 =====
{id:"world_un",keys:["国連","国際連合","ユナイテッドネーションズ"],topic:"world",answer:"国連は、世界のほとんどの国が加盟する国際機関です。戦争の防止と国際協力を目的に、第二次世界大戦の後に設立されました。本部はニューヨークです。"},
{id:"world_un_ga",keys:["国連総会","総会"],topic:"world",answer:"国連総会は、全加盟国が一国一票で参加する会議です。国際的な課題を話し合い、決議を行います。"},
{id:"world_un_sc",keys:["安全保障理事会","安保理"],topic:"world",answer:"安全保障理事会は、国連の中で平和と安全を担う機関です。15か国で構成され、決議には法的拘束力があります。"},
{id:"world_un_p5",keys:["常任理事国","五大国"],topic:"world",answer:"常任理事国は、アメリカ・イギリス・フランス・ロシア・中国の5か国です。安保理に常駐し、拒否権を持ちます。"},
{id:"world_veto",keys:["拒否権"],topic:"world",answer:"拒否権は、常任理事国のうち一国でも反対すれば安保理の決議が成立しない仕組みです。冷戦期からたびたび議論の対象になっています。"},
{id:"world_un_sg",keys:["国連事務総長","事務総長"],topic:"world",answer:"国連事務総長は国連の代表者で、事務局の長です。総会で任命され、任期は5年です。"},
{id:"world_pko",keys:["PKO","平和維持活動","平和維持軍"],topic:"world",answer:"PKOは平和維持活動のことです。紛争地に中立の部隊を派遣し、停戦の監視や治安の安定を助けます。"},
{id:"world_unesco",keys:["ユネスコ","UNESCO"],topic:"world",answer:"ユネスコは国連の専門機関で、教育・科学・文化の協力を担います。世界遺産の登録で知られています。"},
{id:"world_who",keys:["WHO","世界保健機関"],topic:"world",answer:"WHOは世界保健機関です。感染症対策や公衆衛生の国際的な指針作りを担う、国連の専門機関です。"},
{id:"world_wto",keys:["WTO","世界貿易機関"],topic:"world",answer:"WTOは世界貿易機関です。貿易のルールを整え、国同士の貿易摩擦を話し合いで解く場を提供します。"},
{id:"world_imf",keys:["IMF","国際通貨基金"],topic:"world",answer:"IMFは国際通貨基金です。通貨危機に陥った国への融資など、世界の金融の安定を担います。"},
{id:"world_worldbank",keys:["世界銀行","ワールドバンク"],topic:"world",answer:"世界銀行は、発展途上国への長期の融資や技術支援を行う国際機関です。本部はワシントンです。"},
{id:"world_nato",keys:["NATO","北大西洋条約機構"],topic:"world",answer:"NATOは北大西洋条約機構です。加盟国が互いを守る集団防衛の同盟で、一国への攻撃を全体への攻撃とみなす条約を持ちます。"},
{id:"world_eu",keys:["EU","欧州連合","ヨーロッパ連合"],topic:"world",answer:"EUは欧州連合です。ヨーロッパの国々が経済や法律を連携させる枠組みで、人の移動の自由や共通通貨ユーロが特徴です。"},
{id:"world_euro",keys:["ユーロ","欧州単一通貨"],topic:"world",answer:"ユーロはEUの多くの国が使う共通通貨です。導入国では両替なしに国境を越えて買い物ができます。"},
{id:"world_eu_leave",keys:["ブレグジット","イギリスのEU離脱","英国EU離脱"],topic:"world",answer:"イギリスは国民投票の結果を受けてEUを離脱しました。私の記録では（2026年時点）、離脱後も貿易などの協定でEUと結びついています。"},
{id:"world_asean",keys:["ASEAN","東南アジア諸国連合"],topic:"world",answer:"ASEANは東南アジア諸国連合です。地域の経済連携と安定を目的とする、東南アジア10か国の枠組みです。"},
{id:"world_g7",keys:["G7","主要国首脳会議","サミット"],topic:"world",answer:"G7は主要7か国の枠組みです。首脳が集まる会議（サミット）で、経済や安全保障を話し合います。"},
{id:"world_g20",keys:["G20"],topic:"world",answer:"G20は、G7に新興国などを加えた20の国と地域の枠組みです。世界の経済問題を幅広く扱います。"},
{id:"world_oecd",keys:["OECD","経済協力開発機構"],topic:"world",answer:"OECDは経済協力開発機構です。先進国を中心に、経済政策や統計の比較・提言を行います。"},
{id:"world_icj",keys:["国際司法裁判所","ハーグの裁判所"],topic:"world",answer:"国際司法裁判所は、国同士の争いを裁く国連の裁判所です。オランダのハーグにあります。国家間の紛争だけを扱います。"},
{id:"world_icc",keys:["国際刑事裁判所","ICC"],topic:"world",answer:"国際刑事裁判所は、戦争犯罪など重大な犯罪を個人の責任として裁く裁判所です。国際司法裁判所とは別の機関です。"},
{id:"world_redcross",keys:["赤十字","国際赤十字"],topic:"world",answer:"赤十字は、中立の立場で紛争や災害の被災者を支援する人道組織です。傷病者の保護を定めたジュネーブ条約と結びついています。"},
{id:"world_iaea",keys:["IAEA","国際原子力機関"],topic:"world",answer:"IAEAは国際原子力機関です。原子力の平和利用を進め、核が兵器に転用されないよう査察を行います。"},
{id:"world_unhcr",keys:["UNHCR","国連難民高等弁務官","難民機関"],topic:"world",answer:"UNHCRは、難民の保護と支援を担う国連の機関です。紛争や迫害で故郷を追われた人々を支えます。"},
{id:"world_intl_law",keys:["国際法"],topic:"world",answer:"国際法は、国同士の関係を定めるルールの総称です。条約と慣習が柱で、国内法のような一つの立法機関はありません。"},
{id:"world_treaty",keys:["条約","国際条約"],topic:"world",answer:"条約は、国同士が文書で結ぶ約束です。署名した国は内容を守る義務を負います。"},
{id:"world_embassy",keys:["大使館","領事館"],topic:"world",answer:"大使館は、外国に置かれる国の公式な窓口です。自国民の保護や、相手国との交渉を担います。領事館は主に手続きや保護が仕事です。"},
{id:"world_diplomacy",keys:["外交"],topic:"world",answer:"外交は、国が他国と交渉して関係を築く活動です。戦争を避け、利益を調整するための基本手段とされます。"},
{id:"world_eez",keys:["排他的経済水域","EEZ","領海"],topic:"world",answer:"領海は海岸から12海里まで、排他的経済水域（EEZ）は200海里までと定められています。EEZでは魚や海底資源の権利が沿岸国にあります。"},
// ===== 経済・通貨・貿易 =====
{id:"world_currency",keys:["通貨","お金の仕組み"],topic:"world",answer:"通貨は、物やサービスと交換するための共通の尺度です。価値は、国や中央銀行への信用で支えられています。"},
{id:"world_fx",keys:["為替レート","為替","外国為替"],topic:"world",answer:"為替レートは、異なる通貨同士の交換比率です。需要と供給、景気や金利の差で日々変動します。"},
{id:"world_yen_weak",keys:["円安","円高"],topic:"world",answer:"円安は、円の価値が他の通貨に対して下がることです。輸出には有利ですが、輸入品や海外旅行は割高になります。円高はその逆です。"},
{id:"world_inflation",keys:["インフレ","インフレーション","物価上昇"],topic:"world",answer:"インフレは、物価全体が継続的に上がる現象です。お金の価値が下がるので、中央銀行は金利を上げて抑えようとします。"},
{id:"world_deflation",keys:["デフレ","デフレーション"],topic:"world",answer:"デフレは、物価全体が継続的に下がる現象です。買い控えが進むと景気が冷え込む悪循環が心配されます。"},
{id:"world_interest",keys:["金利","利子","利率"],topic:"world",answer:"金利は、お金を貸し借りするときの対価の割合です。景気や物価に合わせて中央銀行が政策金利を動かします。"},
{id:"world_central_bank",keys:["中央銀行"],topic:"world",answer:"中央銀行は、国の通貨を発行し、金融政策で物価と金融の安定を担う銀行です。政府からは独立している国が多いです。"},
{id:"world_boj",keys:["日本銀行","日銀"],topic:"world",answer:"日本銀行は日本の中央銀行です。紙幣の発行と金融政策を担います。総裁は国会の同意を得て任命されます。"},
{id:"world_frb",keys:["FRB","連邦準備制度","アメリカの中央銀行"],topic:"world",answer:"FRBはアメリカの中央銀行制度です。ドルの金融政策を決め、その判断は世界の市場に影響します。"},
{id:"world_gov_bond",keys:["国債"],topic:"world",answer:"国債は、国が資金を借りるために発行する債券です。満期に額面が返り、途中で利子が支払われます。国の信用が価格を左右します。"},
{id:"world_gdp",keys:["GDP","国内総生産"],topic:"world",answer:"GDPは国内総生産です。一定期間に国内で生み出された付加価値の合計で、経済の規模を測る代表的な指標です。"},
{id:"world_trade",keys:["貿易"],topic:"world",answer:"貿易は、国境を越えた物やサービスの売買です。各国が得意な分野に特化し、交換することで全体の豊かさが増える、という考えが基礎にあります。"},
{id:"world_export_import",keys:["輸出","輸入"],topic:"world",answer:"輸出は国内の品を外国へ売ること、輸入は外国の品を買うことです。差額の動きが貿易収支になります。"},
{id:"world_tariff",keys:["関税"],topic:"world",answer:"関税は、輸入品にかける税金です。国内産業を守る効果がある一方、消費者の価格は上がり、報復の応酬になることもあります。"},
{id:"world_free_trade",keys:["自由貿易"],topic:"world",answer:"自由貿易は、関税などの障壁を減らして貿易を活発にする考え方です。価格が下がる利点と、国内産業への打撃という課題の両方があります。"},
{id:"world_fta",keys:["FTA","自由貿易協定","経済連携協定","EPA"],topic:"world",answer:"FTAは自由貿易協定です。結んだ国同士で関税を下げたり撤廃したりします。より幅広い協力まで含むものはEPA（経済連携協定）と呼ばれます。"},
{id:"world_trade_deficit",keys:["貿易赤字","貿易黒字"],topic:"world",answer:"貿易赤字は輸入が輸出を上回る状態、黒字はその逆です。赤字そのものが直ちに悪いわけではなく、経済全体の構造と合わせて見ます。"},
{id:"world_stock",keys:["株式","株"],topic:"world",answer:"株式は、会社の所有権を細かく分けたものです。株主は配当や値上がりの利益を得る一方、値下がりのリスクを負います。"},
{id:"world_stock_index",keys:["株価指数","日経平均","ダウ平均"],topic:"world",answer:"株価指数は、代表的な銘柄の株価をまとめた数字です。日経平均やダウ平均が有名で、市場全体の動きを見る目安に使われます。"},
{id:"world_market",keys:["市場","マーケット"],topic:"world",answer:"市場は、売り手と買い手が集まって価格が決まる仕組みの総称です。実物の市場から、株式のような電子的な取引の場まで含みます。"},
{id:"world_supply_demand",keys:["需要と供給","需給"],topic:"world",answer:"需要は買いたい量、供給は売りたい量です。需要が供給を上回れば価格は上がり、下回れば下がる、というのが価格決定の基本です。"},
{id:"world_tax_vat",keys:["消費税","付加価値税"],topic:"world",answer:"消費税は、物やサービスを買うときに価格に上乗せされる税です。国によって税率や軽減の仕組みが異なります。"},
{id:"world_tax_income",keys:["所得税"],topic:"world",answer:"所得税は、個人の所得にかかる税です。所得が高いほど税率が上がる累進課税を取る国が多いです。"},
{id:"world_pension",keys:["年金"],topic:"world",answer:"年金は、老後や障害の際の生活を支える給付制度です。現役世代の保険料で支える仕組みを基本とする国が多いです。"},
{id:"world_insurance",keys:["保険の仕組み","保険とは"],topic:"world",answer:"保険は、多くの人が少しずつお金を出し合い、万一の損失に備える仕組みです。確率の低い大きな損害を、皆で分け合います。"},
{id:"world_social_security",keys:["社会保障"],topic:"world",answer:"社会保障は、年金・医療・介護・生活保護など、生活の最低限を支える制度の総称です。税と保険料でまかなわれます。"},
{id:"world_unemployment",keys:["失業率","失業"],topic:"world",answer:"失業率は、働く意欲のある人のうち職に就けていない人の割合です。景気の状態を見る基本指標の一つです。"},
{id:"world_min_wage",keys:["最低賃金"],topic:"world",answer:"最低賃金は、法律で定める賃金の下限です。働く人の生活を守る目的で、国や地域ごとに金額が決められます。"},
{id:"world_company",keys:["株式会社","株主"],topic:"world",answer:"株式会社は、株式を発行して資金を集める会社の形です。株主が持ち分に応じて権利を持ち、経営は取締役などに委ねられます。"},
{id:"world_ipo",keys:["上場","IPO","新規公開株"],topic:"world",answer:"上場は、会社の株式が証券取引所で誰でも売買できるようになることです。資金調達の幅が広がる一方、情報公開の義務が生じます。"},
{id:"world_supply_chain",keys:["サプライチェーン","供給網"],topic:"world",answer:"サプライチェーンは、原材料から製品が届くまでの一連の流れです。世界中に分散しているため、一か所の停滞が全体に響くことがあります。"},
{id:"world_semiconductor",keys:["半導体"],topic:"world",answer:"半導体は、電気の流れを制御できる素材と、それを使った部品の総称です。電子機器の頭脳にあたり、世界経済の要とされます。"},
{id:"world_recession",keys:["景気","不景気","好景気"],topic:"world",answer:"景気は経済全体の調子のことです。生産や雇用、消費の動きで判断され、拡大と後退を繰り返す波として捉えられます。"},
{id:"world_fiscal",keys:["財政","財政赤字"],topic:"world",answer:"財政は、政府のお金の出入りです。支出が税収を上回る状態が財政赤字で、国債の発行でまかなわれます。"},
{id:"world_antitrust",keys:["独占禁止法","独占"],topic:"world",answer:"独占は、一社だけが市場を支配する状態です。競争を守るため、多くの国に独占を防ぐ法律があります。"},
{id:"world_tourism",keys:["観光産業","観光立国"],topic:"world",answer:"観光は、旅行者の消費を通じて地域にお金をもたらす産業です。雇用を生む一方、混雑や環境負荷という課題も持ちます。"},
{id:"world_crypto",keys:["暗号資産","仮想通貨","ビットコイン"],topic:"world",answer:"暗号資産は、暗号技術で取引を記録するデジタル資産です。価格の変動が大きく、国の通貨とは仕組みも位置づけも異なります。"},
{id:"world_remittance",keys:["海外送金","送金"],topic:"world",answer:"海外で働く人から故郷への送金は、多くの国で重要な資金の流れです。家族の生活費や教育費に充てられます。"},
// ===== エネルギー =====
{id:"world_fossil",keys:["化石燃料"],topic:"world",answer:"化石燃料は、石油・石炭・天然ガスの総称です。太古の生物の死骸が地中で変化したもので、燃やすと二酸化炭素が出ます。"},
{id:"world_renewable",keys:["再生可能エネルギー","再エネ"],topic:"world",answer:"再生可能エネルギーは、太陽光や風力など、自然の流れから繰り返し得られるエネルギーです。枯渇せず、発電時に二酸化炭素を出しません。"},
{id:"world_solar",keys:["太陽光発電","ソーラーパネル"],topic:"world",answer:"太陽光発電は、光を電気に変えるパネルを使う発電です。天気と昼夜に左右されるため、蓄電池と組み合わせる工夫が進んでいます。"},
{id:"world_wind_power",keys:["風力発電"],topic:"world",answer:"風力発電は、風で大きな羽根を回して電気を作ります。海上に設置する洋上風力も広がっています。"},
{id:"world_hydro",keys:["水力発電","ダム発電"],topic:"world",answer:"水力発電は、高い所から落ちる水の力で発電します。古くから使われる方法で、出力の調整がしやすいのが特長です。"},
{id:"world_geothermal",keys:["地熱発電"],topic:"world",answer:"地熱発電は、地下の熱で作った蒸気を使う発電です。火山の多い国に向いていて、天候に左右されません。"},
{id:"world_nuclear",keys:["原子力発電","原発"],topic:"world",answer:"原子力発電は、核分裂の熱で蒸気を作り発電します。二酸化炭素は出しませんが、事故と放射性廃棄物の扱いが大きな論点です。"},
{id:"world_fission_fusion",keys:["核分裂","核融合"],topic:"world",answer:"核分裂は重い原子核が割れる反応で、現在の原子力発電が使うものです。核融合は軽い原子核が合体する反応で、太陽の内部で起きています。実用化は研究段階です。"},
{id:"world_thermal_power",keys:["火力発電"],topic:"world",answer:"火力発電は、燃料を燃やした熱で発電します。出力調整がしやすい反面、二酸化炭素の排出が課題です。"},
{id:"world_grid",keys:["送電","電力網","送電網"],topic:"world",answer:"電気は発電所から送電網を通って届きます。電気は大量に貯められないため、使う量と作る量を常に一致させる運用が要ります。"},
{id:"world_oil",keys:["石油","原油"],topic:"world",answer:"石油は、燃料やプラスチックの原料になる資源です。産地が偏っているため、価格と供給は国際情勢の影響を受けやすいです。"},
{id:"world_opec",keys:["OPEC","石油輸出国機構"],topic:"world",answer:"OPECは石油輸出国機構です。産油国が加盟し、生産量の調整を通じて価格への影響力を持ちます。"},
{id:"world_lng",keys:["天然ガス","LNG","液化天然ガス"],topic:"world",answer:"天然ガスは、燃やしたときの二酸化炭素が石炭より少ない化石燃料です。マイナス162度まで冷やして液化したものがLNGで、船で運ばれます。"},
{id:"world_coal",keys:["石炭"],topic:"world",answer:"石炭は、最も古くから使われる化石燃料です。豊富で安い一方、燃やすと二酸化炭素を多く出します。"},
{id:"world_hydrogen",keys:["水素エネルギー","水素社会"],topic:"world",answer:"水素は、使うときに水しか出さないエネルギー媒体です。作るときに再生可能エネルギーを使うかが、環境価値の分かれ目になります。"},
{id:"world_battery",keys:["蓄電池","バッテリーの仕組み"],topic:"world",answer:"蓄電池は、電気を化学エネルギーとして貯める装置です。再エネの変動を吸収し、電気自動車にも欠かせません。"},
{id:"world_ev",keys:["電気自動車","EV"],topic:"world",answer:"電気自動車は、モーターで走る車です。走行中は排気ガスを出しません。充電設備と電力の作り方が普及の鍵とされます。"},
{id:"world_energy_security",keys:["エネルギー安全保障","エネルギー自給率"],topic:"world",answer:"エネルギー安全保障は、必要なエネルギーを安定して確保することです。自給率の低い国ほど、輸入先の分散が課題になります。"},
{id:"world_smart_grid",keys:["スマートグリッド"],topic:"world",answer:"スマートグリッドは、情報通信で電力の流れを細かく制御する送電網の考え方です。再エネの大量導入を支える技術とされます。"},
{id:"world_carbon_price",keys:["炭素税","カーボンプライシング","排出量取引"],topic:"world",answer:"炭素税は、二酸化炭素の排出に価格をつける仕組みです。排出量取引と合わせて、削減への経済的な動機づけとして使われます。"},
// ===== 気候・環境 =====
{id:"world_greenhouse",keys:["温室効果ガス","温室効果"],topic:"world",answer:"温室効果ガスは、大気を暖める性質を持つ気体です。二酸化炭素やメタンが代表で、増えすぎると気温が上がると考えられています。"},
{id:"world_co2",keys:["二酸化炭素","CO2"],topic:"world",answer:"二酸化炭素は、物を燃やしたり呼吸したりすると出る気体です。化石燃料の使用で大気中の濃度が上がり続けています。"},
{id:"world_warming",keys:["地球温暖化"],topic:"world",answer:"地球温暖化は、温室効果ガスの増加で地球の平均気温が上がる現象です。海面上昇や異常気象の増加と結びつけて論じられます。"},
{id:"world_climate_change",keys:["気候変動"],topic:"world",answer:"気候変動は、気温だけでなく雨の降り方や嵐の頻度など、気候全体の長期的な変化を指します。温暖化より広い言葉です。"},
{id:"world_paris",keys:["パリ協定"],topic:"world",answer:"パリ協定は、気候変動への国際的な取り決めです。世界の平均気温の上昇を産業革命前と比べて2度未満、できれば1.5度に抑える目標を掲げます。"},
{id:"world_carbon_neutral",keys:["カーボンニュートラル","脱炭素","ネットゼロ"],topic:"world",answer:"カーボンニュートラルは、二酸化炭素の排出と吸収を差し引きゼロにすることです。多くの国が今世紀半ばまでの達成を目標に掲げています。"},
{id:"world_sdgs",keys:["SDGs","持続可能な開発目標"],topic:"world",answer:"SDGsは、国連が定めた17の持続可能な開発目標です。貧困、教育、環境など、2030年までの達成を目指す国際的な約束です。"},
{id:"world_elnino",keys:["エルニーニョ","ラニーニャ"],topic:"world",answer:"エルニーニョは、太平洋の赤道付近の海水温が上がる現象です。世界の天候に影響し、干ばつや大雨の偏りを引き起こすことがあります。逆はラニーニャです。"},
{id:"world_ozone",keys:["オゾン層","オゾンホール"],topic:"world",answer:"オゾン層は、上空で紫外線を吸収する層です。フロンガスで破壊が進みましたが、国際的な規制で回復傾向にあるとされます。"},
{id:"world_acid_rain",keys:["酸性雨"],topic:"world",answer:"酸性雨は、工場や車の排気に含まれる物質が溶け込んだ、酸性の強い雨です。森林や湖、建物に被害を与えることがあります。"},
{id:"world_biodiversity",keys:["生物多様性"],topic:"world",answer:"生物多様性は、生き物の種類や遺伝子、生態系の豊かさのことです。食料や医薬品など、人間の暮らしもこの多様さに支えられています。"},
{id:"world_endangered",keys:["絶滅危惧種","絶滅"],topic:"world",answer:"絶滅危惧種は、絶滅のおそれがあると評価された生き物です。国際機関がレッドリストとして公表し、保護の目安になっています。"},
{id:"world_plastic",keys:["プラスチック問題","マイクロプラスチック"],topic:"world",answer:"プラスチックごみは自然に分解されにくく、海に流出すると細かく砕けて生き物に取り込まれます。これがマイクロプラスチックの問題です。"},
{id:"world_recycle",keys:["リサイクル","循環型社会"],topic:"world",answer:"リサイクルは、使い終わった物を原料に戻して再利用することです。資源の消費とごみの量を減らす仕組みとして広がっています。"},
{id:"world_sea_level",keys:["海面上昇"],topic:"world",answer:"海面上昇は、氷の融解と海水の熱膨張で海の高さが上がる現象です。低い土地の多い地域では、浸水の危険が高まります。"},
{id:"world_desert",keys:["砂漠化"],topic:"world",answer:"砂漠化は、乾燥地の土地が劣化して生産力を失う現象です。気候の変化と、過剰な放牧や耕作などの人為的要因が重なって進みます。"},
{id:"world_water_cycle",keys:["水循環","水の循環"],topic:"world",answer:"水は、海や陸から蒸発し、雲になり、雨として戻る循環をしています。飲み水はこの循環の一部で、地域によって偏りが大きいです。"},
{id:"world_heatwave",keys:["熱波","猛暑の仕組み"],topic:"world",answer:"熱波は、異常に暑い天気が数日以上続く現象です。高気圧が居座ることなどで起き、健康被害が問題になります。"},
{id:"world_typhoon_form",keys:["台風の仕組み","台風はどうやってできる","ハリケーン","サイクロン"],topic:"world",answer:"台風は、暖かい海の上で生まれる熱帯低気圧が発達したものです。海水の蒸発がエネルギー源です。地域によってハリケーン、サイクロンと呼び名が変わります。"},
{id:"world_deforestation",keys:["森林破壊","熱帯雨林"],topic:"world",answer:"森林は二酸化炭素を吸収し、多くの生き物の住処です。農地転換などで失われると、気候と生態系の両方に影響します。"},
{id:"world_food_loss",keys:["食品ロス","フードロス"],topic:"world",answer:"食品ロスは、食べられるのに捨てられる食品のことです。生産と流通、消費の各段階で発生し、環境負荷の面でも問題視されます。"},
{id:"world_methane",keys:["メタン"],topic:"world",answer:"メタンは、二酸化炭素に次いで影響の大きい温室効果ガスです。家畜の消化や、水田、化石燃料の採掘などから出ます。"},
// ===== 地理 =====
{id:"world_continents",keys:["大陸はいくつ","七大陸","大陸の数"],topic:"world",answer:"大陸は、アジア・ヨーロッパ・アフリカ・北アメリカ・南アメリカ・オーストラリア・南極の7つに分けるのが一般的です。分け方には流儀があります。"},
{id:"world_oceans",keys:["三大洋","太平洋","大西洋","インド洋"],topic:"world",answer:"大きな海は太平洋・大西洋・インド洋の三大洋に、南極海と北極海を加えることもあります。太平洋が最大です。"},
{id:"world_equator",keys:["赤道"],topic:"world",answer:"赤道は、地球を南北に分ける緯度0度の線です。太陽の光をほぼ真上から受けるため、一年を通して暑い地域が多くなります。"},
{id:"world_latlng",keys:["緯度","経度"],topic:"world",answer:"緯度は赤道からの南北の位置、経度はイギリスのグリニッジを基準にした東西の位置です。2つを合わせると地球上の一点が決まります。"},
{id:"world_timezone",keys:["時差"],topic:"world",answer:"時差は、地球の自転によって場所ごとに時刻がずれることです。経度15度でおよそ1時間の差になります。国によっては国内でも複数の時刻を使います。"},
{id:"world_seasons_why",keys:["四季がある理由","季節の仕組み","なぜ季節"],topic:"world",answer:"季節は、地軸が傾いたまま太陽の周りを回るために生まれます。傾きの向きで、北半球と南半球では季節が逆になります。"},
{id:"world_tide",keys:["潮の満ち引き","潮汐"],topic:"world",answer:"潮の満ち引きは、主に月の引力が海水を引くことで起きます。太陽の影響も加わり、大潮と小潮の周期が生まれます。"},
{id:"world_capital_us",keys:["アメリカの首都","米国の首都"],topic:"world",answer:"アメリカの首都はワシントンD.C.です。最大の都市はニューヨークですが、首都ではありません。"},
{id:"world_capital_uk",keys:["イギリスの首都","英国の首都"],topic:"world",answer:"イギリスの首都はロンドンです。テムズ川沿いの古い都市で、政治と金融の中心です。"},
{id:"world_capital_fr",keys:["フランスの首都"],topic:"world",answer:"フランスの首都はパリです。セーヌ川沿いに広がる、芸術と歴史の都市として知られます。"},
{id:"world_capital_de",keys:["ドイツの首都"],topic:"world",answer:"ドイツの首都はベルリンです。東西分断の時代を経て、再統一後に首都へ戻りました。"},
{id:"world_capital_cn",keys:["中国の首都"],topic:"world",answer:"中国の首都は北京です。国の北部にあり、政治の中心です。経済の中心は上海とされます。"},
{id:"world_capital_kr",keys:["韓国の首都"],topic:"world",answer:"韓国の首都はソウルです。人口の集中する大都市で、国の北西部にあります。"},
{id:"world_capital_ru",keys:["ロシアの首都"],topic:"world",answer:"ロシアの首都はモスクワです。ヨーロッパ側にあり、人口も最大級の都市です。"},
{id:"world_capital_in",keys:["インドの首都"],topic:"world",answer:"インドの首都はニューデリーです。古いデリーの隣に作られた行政の中心地です。"},
{id:"world_capital_au",keys:["オーストラリアの首都"],topic:"world",answer:"オーストラリアの首都はキャンベラです。最大都市のシドニーではありません。計画都市として作られました。"},
{id:"world_capital_br",keys:["ブラジルの首都"],topic:"world",answer:"ブラジルの首都はブラジリアです。内陸開発のために20世紀に新しく作られた計画都市です。"},
{id:"world_capital_ca",keys:["カナダの首都"],topic:"world",answer:"カナダの首都はオタワです。最大都市はトロントですが、首都はオタワに置かれています。"},
{id:"world_capital_it",keys:["イタリアの首都"],topic:"world",answer:"イタリアの首都はローマです。古代ローマ帝国の中心だった、歴史の重い都市です。"},
{id:"world_capital_es",keys:["スペインの首都"],topic:"world",answer:"スペインの首都はマドリードです。国の中央の高原にあります。"},
{id:"world_largest_country",keys:["一番大きな国","最大の国","面積が一番広い国","一番面積が広い国","面積が広い国"],topic:"world",answer:"面積が最大の国はロシアです。ユーラシア大陸の北部に広がり、多くの国と国境を接します。"},
{id:"world_population_top",keys:["人口が一番多い国","人口最大の国"],topic:"world",answer:"私の記録では（2026年時点）、人口が最大の国はインドです。国連の推計で中国を上回ったとされています。"},
{id:"world_sahara",keys:["サハラ砂漠","一番大きな砂漠"],topic:"world",answer:"サハラ砂漠はアフリカ北部に広がる世界最大級の砂漠です。面積はアメリカ合衆国に匹敵するほどとされます。"},
{id:"world_longest_river",keys:["一番長い川","最長の川"],topic:"world",answer:"最長の川はナイル川とされます。アマゾン川と首位を争いますが、水量ではアマゾンが圧倒的です。"},
{id:"world_everest",keys:["エベレスト","一番高い山","世界最高峰"],topic:"world",answer:"世界最高峰はエベレストで、標高は約8,849メートルです。ヒマラヤ山脈にあり、ネパールと中国の国境に位置します。"},
{id:"world_mariana",keys:["マリアナ海溝","一番深い海"],topic:"world",answer:"最も深い場所はマリアナ海溝で、水深は約1万メートルに達します。エベレストを沈めても山頂が水面に出ない深さです。"},
{id:"world_japan_geo",keys:["日本の都道府県","都道府県の数"],topic:"world",answer:"日本は1都1道2府43県、合わせて47都道府県です。本州・北海道・九州・四国と、多くの島々からなる島国です。"},
{id:"world_fuji",keys:["富士山の高さ","富士山"],topic:"world",answer:"富士山の標高は3,776メートルで、日本の最高峰です。独立峰として美しい円錐形をしています。"},
{id:"world_arctic_antarctic",keys:["北極と南極","南極","北極"],topic:"world",answer:"北極は海の上に浮かぶ氷、南極は氷に覆われた大陸です。ペンギンは南極圏、ホッキョクグマは北極圏の生き物です。"},
{id:"world_international_dateline",keys:["日付変更線"],topic:"world",answer:"日付変更線は、太平洋上を南北に走る線です。これを西へ越えると日付が1日進み、東へ越えると1日戻ります。"},
{id:"world_island_nations",keys:["島国"],topic:"world",answer:"島国は、国土が島々からなる国です。日本やイギリス、インドネシアなどが代表で、海との関わりが経済や文化を形作ります。"},
{id:"world_strait",keys:["海峡","マラッカ海峡","スエズ運河","パナマ運河"],topic:"world",answer:"海峡や運河は、海の交通の要所です。マラッカ海峡、スエズ運河、パナマ運河は世界貿易の大動脈で、塞がれると物流全体に響きます。"},
{id:"world_monsoon",keys:["モンスーン","季節風"],topic:"world",answer:"モンスーンは、季節で向きの変わる大きな風です。海と陸の温まり方の差で生まれ、アジアの雨季をもたらします。"},
{id:"world_earthquake_belt",keys:["環太平洋火山帯","地震が多い地域"],topic:"world",answer:"地震と火山は、プレートの境界に集中します。太平洋を取り巻く環太平洋火山帯はその代表で、日本も含まれます。"},
{id:"world_nile_civilization",keys:["四大文明","古代文明"],topic:"world",answer:"古代文明は大きな川の流域で栄えました。ナイル川のエジプト、チグリス・ユーフラテスのメソポタミア、インダス川、黄河が代表です。"},
// ===== 歴史的な位置づけ =====
{id:"world_industrial_rev",keys:["産業革命"],topic:"world",answer:"産業革命は、18世紀後半にイギリスで始まった生産方式の大変化です。蒸気機関と工場制が広がり、社会の姿を変えました。"},
{id:"world_ww1",keys:["第一次世界大戦"],topic:"world",answer:"第一次世界大戦は1914年から1918年の戦争です。同盟の連鎖で欧州全体に広がり、戦後の国際連盟設立につながりました。"},
{id:"world_ww2",keys:["第二次世界大戦"],topic:"world",answer:"第二次世界大戦は1939年から1945年の戦争です。世界規模の被害の反省から、国連の設立や戦後の国際秩序が生まれました。"},
{id:"world_cold_war",keys:["冷戦"],topic:"world",answer:"冷戦は、第二次大戦後のアメリカとソ連の対立です。直接の戦争は避けつつ、世界各地で陣営争いが続きました。"},
{id:"world_berlin_wall",keys:["ベルリンの壁"],topic:"world",answer:"ベルリンの壁は、東西に分断されたベルリンを隔てた壁です。1989年に崩壊し、冷戦の終わりを象徴する出来事になりました。"},
{id:"world_ussr_end",keys:["ソ連崩壊","ソビエト連邦"],topic:"world",answer:"ソ連（ソビエト連邦）は1991年に解体されました。構成していた共和国が独立し、冷戦構造は終わりました。"},
{id:"world_age_of_discovery",keys:["大航海時代"],topic:"world",answer:"大航海時代は、15世紀から17世紀にヨーロッパの船が世界へ出た時代です。交易が広がる一方、植民地化という暗い側面も持ちます。"},
{id:"world_renaissance",keys:["ルネサンス"],topic:"world",answer:"ルネサンスは、ヨーロッパで古典文化を見直す動きが広がった時代です。芸術と科学の発展が、近代への橋渡しになりました。"},
{id:"world_printing",keys:["印刷術","活版印刷"],topic:"world",answer:"活版印刷の普及は、本の価格を下げ、知識の広がりを速めました。宗教改革や科学の進展を後押しした技術とされます。"},
{id:"world_roman_empire",keys:["ローマ帝国"],topic:"world",answer:"ローマ帝国は、地中海世界を支配した古代の大帝国です。法律や土木、言語の影響は、現代のヨーロッパにも残ります。"},
{id:"world_ottoman",keys:["オスマン帝国"],topic:"world",answer:"オスマン帝国は、現在のトルコを中心に長く続いた帝国です。ヨーロッパ・アジア・アフリカにまたがる大国でした。"},
{id:"world_mongol",keys:["モンゴル帝国","チンギスハン"],topic:"world",answer:"モンゴル帝国は、13世紀にユーラシア大陸の広い範囲を支配しました。東西の交易路が結ばれ、交流が活発になった面もあります。"},
{id:"world_silk_road",keys:["シルクロード"],topic:"world",answer:"シルクロードは、中国と地中海世界を結んだ交易路の総称です。絹だけでなく、技術や宗教、文化も行き来しました。"},
{id:"world_meiji",keys:["明治維新"],topic:"world",answer:"明治維新は、19世紀後半の日本の大きな変革です。江戸幕府が終わり、近代国家への制度作りが急速に進みました。"},
{id:"world_edo_length",keys:["江戸時代"],topic:"world",answer:"江戸時代は、17世紀初めから19世紀後半までの約260年です。大きな戦争のない期間が長く続いた時代として知られます。"},
{id:"world_democracy_origin",keys:["民主主義の起源","古代ギリシャ"],topic:"world",answer:"民主主義の源流は古代ギリシャのアテネとされます。市民が集会で直接決める形から始まり、現代の代議制へ発展しました。"},
{id:"world_human_rights",keys:["人権宣言","人権とは"],topic:"world",answer:"人権は、人間が生まれながらに持つとされる権利です。18世紀の宣言を経て、第二次大戦後の世界人権宣言で国際的な基準になりました。"},
{id:"world_slavery_abolition",keys:["奴隷制","奴隷貿易"],topic:"world",answer:"奴隷制は、人を財産として扱う制度です。19世紀に多くの国で廃止されましたが、その歴史は現代社会にも影を残しています。"},
{id:"world_women_suffrage",keys:["女性参政権","婦人参政権"],topic:"world",answer:"女性の参政権は、19世紀末から20世紀にかけて各国で認められました。日本では第二次世界大戦後に実現しました。"},
{id:"world_apollo",keys:["アポロ11号","月面着陸","人類初の月"],topic:"world",answer:"1969年、アポロ11号で人類が初めて月に降り立ちました。冷戦期の宇宙開発競争の頂点とされる出来事です。"},
{id:"world_internet_history",keys:["インターネットの歴史","インターネットはいつから"],topic:"world",answer:"インターネットは、研究機関同士をつなぐネットワークから始まりました。1990年代にウェブが広がり、一般の暮らしに入りました。"},
{id:"world_colonial_independence",keys:["植民地独立","脱植民地化"],topic:"world",answer:"第二次世界大戦後、アジアとアフリカの植民地が次々に独立しました。新しい国々が国連に加わり、国際社会の姿が大きく変わりました。"},
{id:"world_great_depression",keys:["世界恐慌"],topic:"world",answer:"世界恐慌は、1929年の株価暴落から広がった深刻な不況です。各国の経済政策や、その後の歴史の流れに大きな影響を与えました。"},
{id:"world_league_of_nations",keys:["国際連盟"],topic:"world",answer:"国際連盟は、第一次世界大戦の後に作られた国際機関です。第二次大戦を防げなかった反省が、国連の設計に活かされました。"},
// ===== 政治の仕組み =====
{id:"world_democracy",keys:["民主主義とは","民主主義"],topic:"world",answer:"民主主義は、政治の決定に国民が参加する仕組みです。選挙で代表を選び、多数決と少数意見の尊重の両立が課題になります。"},
{id:"world_separation_powers",keys:["三権分立"],topic:"world",answer:"三権分立は、立法・行政・司法の権力を分け、互いに抑止させる仕組みです。権力の集中を防ぐための設計です。"},
{id:"world_election",keys:["選挙の仕組み","選挙とは"],topic:"world",answer:"選挙は、有権者の投票で代表者を選ぶ仕組みです。秘密投票と普通選挙が、現代の民主主義の基本とされます。"},
{id:"world_proportional",keys:["比例代表","小選挙区"],topic:"world",answer:"比例代表は、得票率に応じて議席を分ける方式です。小選挙区制は、各区で1位だけが当選します。両者にはそれぞれ長所と短所があります。"},
{id:"world_presidential",keys:["大統領制"],topic:"world",answer:"大統領制は、国民が選んだ大統領が行政の長になる仕組みです。議会と大統領が別々に選ばれるのが特徴です。"},
{id:"world_parliamentary",keys:["議院内閣制"],topic:"world",answer:"議院内閣制は、議会の多数派から内閣が生まれる仕組みです。内閣は議会の信任に支えられ、日本やイギリスが採用しています。"},
{id:"world_constitution",keys:["憲法とは","憲法"],topic:"world",answer:"憲法は、国の統治の基本を定める最高法規です。国民の権利と、国家権力の行使の仕方を定めます。"},
{id:"world_political_party",keys:["政党"],topic:"world",answer:"政党は、政治の考えを共有する人々の組織です。選挙で議席を競い、政権を担ったり野党として監視したりします。"},
{id:"world_federal",keys:["連邦制","連邦国家"],topic:"world",answer:"連邦制は、州などの自治体が集まって一つの国を作る形です。アメリカやドイツが代表で、州にも独自の法律があります。"},
{id:"world_local_gov",keys:["地方自治"],topic:"world",answer:"地方自治は、地域のことを地域で決める仕組みです。国と役割を分け、身近な行政を担います。"},
{id:"world_monarchy",keys:["立憲君主制","君主制","王室"],topic:"world",answer:"立憲君主制は、君主がいても政治の実権は憲法と議会にある仕組みです。イギリスや日本がこの形を取ります。"},
{id:"world_referendum",keys:["国民投票","住民投票"],topic:"world",answer:"国民投票は、特定の重要事項を国民の直接投票で決める仕組みです。代表を選ぶ選挙とは別の、直接参加の形です。"},
{id:"world_border",keys:["国境"],topic:"world",answer:"国境は、国の領域を分ける線です。川や山脈などの自然に沿うものと、直線のように人為的に引かれたものがあります。"},
{id:"world_passport_visa",keys:["パスポート","ビザ","査証"],topic:"world",answer:"パスポートは国が発行する身分証で、外国への渡航に必要です。ビザは、入国を認める相手国側の許可です。"},
{id:"world_refugee_def",keys:["難民とは","難民"],topic:"world",answer:"難民は、紛争や迫害から逃れて国境を越えた人々です。国際条約で、送り返さない原則などの保護が定められています。"},
{id:"world_immigration",keys:["移民"],topic:"world",answer:"移民は、暮らす国を移す人々のことです。労働や家族、留学など理由は様々で、受け入れのあり方は各国の政策課題です。"},
{id:"world_population_growth",keys:["世界人口","人口増加"],topic:"world",answer:"私の記録では（2026年時点）、世界人口は80億人を超えています。増加の中心は発展途上国で、先進国では少子高齢化が進む、という二つの流れがあります。"},
{id:"world_aging",keys:["少子高齢化","高齢化社会"],topic:"world",answer:"少子高齢化は、子どもの割合が減り、高齢者の割合が増える変化です。年金や医療、労働力の確保が社会の課題になります。"},
{id:"world_urbanization",keys:["都市化","都市人口"],topic:"world",answer:"都市化は、人口が都市に集中する流れです。世界の人口の半分以上が都市に住む時代になりました。機会と混雑の両方を生みます。"},
{id:"world_religions",keys:["世界の宗教","主要な宗教"],topic:"world",answer:"世界の主な宗教には、キリスト教、イスラム教、ヒンドゥー教、仏教などがあります。信じる人の数は地域で大きく偏りがあります。"},
{id:"world_lingua_franca",keys:["英語が共通語","国際語","リンガフランカ"],topic:"world",answer:"英語は、異なる言語の人々が意思疎通するための共通語として広く使われます。歴史的な経緯と、経済・科学での使用の多さが理由です。"},
{id:"world_pandemic",keys:["パンデミック","感染症の流行"],topic:"world",answer:"パンデミックは、感染症が世界規模で流行する状態です。人の移動が速い現代では、国際的な協力体制が重要になります。"},
{id:"world_vaccine",keys:["ワクチン"],topic:"world",answer:"ワクチンは、病原体の力を弱めたものなどで免疫を付ける医薬品です。集団で接種率が上がると、流行そのものを抑えられます。"},
{id:"world_iss",keys:["国際宇宙ステーション","ISS"],topic:"world",answer:"国際宇宙ステーションは、各国が協力して運用する宇宙の実験施設です。地上約400キロを周回し、宇宙飛行士が滞在します。"},
{id:"world_gps",keys:["GPSの仕組み","GPS"],topic:"world",answer:"GPSは、人工衛星からの電波の到達時間の差で位置を測る仕組みです。複数の衛星を使うことで、地球上の位置が数メートル単位で分かります。"},
{id:"world_ai_society",keys:["AIとは","人工知能"],topic:"world",answer:"人工知能は、学習や推論のような知的な処理を機械に行わせる技術の総称です。……私の専門は、あなたの隣で作業することですが。"},
{id:"world_sns",keys:["SNS","ソーシャルメディア"],topic:"world",answer:"SNSは、人同士が情報を発信し合うネット上の仕組みです。速く広く届く一方、誤情報の拡散が課題とされます。"},
{id:"world_fake_news",keys:["フェイクニュース","誤情報","デマ"],topic:"world",answer:"誤情報は、間違った情報が事実のように広がる現象です。出典を確認することと、複数の情報源に当たることが基本の対策です。"},
{id:"world_olympics",keys:["オリンピック"],topic:"world",answer:"オリンピックは、古代ギリシャの祭典に由来する国際スポーツ大会です。4年に一度、夏と冬の大会が開かれます。"},
{id:"world_world_cup",keys:["ワールドカップ","サッカーの世界大会"],topic:"world",answer:"サッカーのワールドカップは、4年に一度の世界選手権です。国別対抗で、世界で最も注目を集めるスポーツ大会の一つです。"},
{id:"world_time_standard",keys:["協定世界時","UTC","標準時"],topic:"world",answer:"協定世界時（UTC）は、世界の時刻の基準です。各国の標準時は、UTCからの差で表されます。日本は9時間進んでいます。"},
];

// 正規化: 小文字化し、空白と読点を除去する（mc_knowledge と同一方式）
function norm(s) {
  return String(s ?? "").toLowerCase().replace(/[\s　、。・!！?？]/g, "");
}

// キーの出現頻度（文書頻度）。汎用キーの重みを下げる
const KEY_FREQ = new Map();
for (const e of KNOWLEDGE_WORLD) {
  for (const k of new Set(e.keys.map(norm))) {
    if (k) KEY_FREQ.set(k, (KEY_FREQ.get(k) || 0) + 1);
  }
}

export function lookupWorld(text) {
  const t = norm(text);
  if (!t) return null;
  let best = null, bestScore = 0;
  for (const e of KNOWLEDGE_WORLD) {
    let score = 0;
    for (const k of e.keys) {
      const nk = norm(k);
      if (!nk) continue;
      const idx = t.indexOf(nk);
      if (idx < 0) continue;
      const freq = KEY_FREQ.get(nk) || 1;
      score += (nk.length * nk.length + 4) / freq + (1 - idx / t.length) * 3;
    }
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return bestScore > 0 ? best : null;
}

export function countWorld() {
  return KNOWLEDGE_WORLD.length;
}
