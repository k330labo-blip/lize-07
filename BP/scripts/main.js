// リゼ (LIZE-07) — お供・作業Bot（版数は config.js の VERSION が正）
// 脳: brain/all.js の意思決定表を10tickごとに評価し、移動と発話を別レイヤーで実行する
// v0.4.x: 指示ミッション・長期自律タスク（分解＋技術ツリー＋ブランチマイニング）・飛行・建築・工場設計・装備・会話調停を統合
// 永続化: エンティティDP（持ち主/モード/拠点/好感度/累計/注文/ミッション）とワールドDP（死亡地点/回収時の所持品）
import { world, system, ItemStack, EquipmentSlot } from "@minecraft/server";
import * as mcServer from "@minecraft/server";
const mcGametest = null; // v0.4.71 統合: ベータAPI (server-gametest) は使わない構成。体 (body_sim) は null で無効化され従来移動になる。有効化するには import と manifest 依存の追加が必要 (引き継ぎ資料参照)
import { createBodyManager } from "./body_sim.js"; // v0.4.58: カスタムコマンド系の列挙型は存在しない環境で import 自体が落ちないよう名前空間経由で参照する
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { BOT_ID, REMOTE_ID, GVC_HOSTILE_SET, isContainerBlock, isValuable, isFood, isJunk, isWeaponish, RANGED_IDS, BOSS_IDS, ACT_LINE_CATEGORY, ACT_LABEL, FLY_ENABLE, DELIVER_RANGE, LT_DELIVER_FAIL_LIMIT, LT_DELIVER_TIMEOUT_MS, BUILD_NO_PROGRESS_TIMEOUT_MS, VERSION, LIZE_DEBUG, GOAP_ADOPT_S1B, BODY_SIM_ENABLE } from "./config.js";
import { decide, decideGaze } from "./brain.js";
import { ALL_LINES, CHAT_ALL, CHAT_LORE, LORE_DEEP_MIN_BOND, FOLLOWUPS, RULE_COUNT } from "./brain/all.js";
import { OF_FOODS, OF_CONTAINERS } from "./brain/compat_orbital.js";
import { createWithdrawExecutor, WITHDRAW_RANGE } from "./withdraw.js";
import { plan as goapPlan, sourcingActions } from "./goap.js"; // Phase3 GOAP-lite (v0.4.12): 影評価のみ (記録専用、実行系は不変)
import { createPlanRunner, createSystemScheduler } from "./goap_runner.js"; // Phase4 P4-A S2-2 (cyc2364): 配線のみ (request は S2-3 まで出さない・挙動変化なし)
import { buildEvaluationFromCtx } from "./goap_state.js"; // Phase3 (v0.4.14): 影評価 state builder (CRAFT/PLACE 含む計画空間、三状態)
import { evaluateFirstStepP3, buildP3Material } from "./goap_exec.js";
import { makeInvGoal, evalGoal, goalKey } from "./goal_pred.js"; // Phase3 NQ-02 (v0.4.17): Goal述語の正式表現 (記録専用) // Phase3 S1a (v0.4.15): Plan第一手ゲート (記録専用、実行・分岐は変えない)
import { revalidateP4 } from "./goap_revalidate.js";
import { buildUnifiedRecord, buildAdoptUnifiedRecord } from "./goap_unified.js";
import { computePlanSig, needRemainOf } from "./goap_sig.js"; // Phase3 S1b P4拡張 (v0.4.22): 計画署名・残必要量 (記録専用)
import { revalidateFull } from "./goap_revalidate_full.js"; // Phase3 S1b P4拡張 (v0.4.22): 全項目同一性再検証 (記録専用) // Phase3 S1b P5 (v0.4.21): P3∧P4 合成レコード (記録専用、複写のみ) // Phase3 S1b P4 (v0.4.20): 採用時同一性再検証 (記録専用、denyは出さない)
import { buildRecipes, WOOD_SPECIES } from "./recipes.js"; // Phase3 (v0.4.14): レシピ単一の正を影評価へ注入
import { chooseGoal } from "./planner.js";
import createWorldMemory from "./world_memory.js";
import { genSpeech } from "./gen_speech.js";
import { parseOrder, resumeClarifyOrder, classifyClarifyUnmatched } from "./order_parser.js";
import { resolveItem } from "./decomposer.js"; // 倉庫 W3-TEACH (cyc2355): 素材名→typeId の単一の正 (注文経路と共用)
import { resolveRequestedTool, toolItemIdOf } from "./tool_request_math.js"; // 0-C4 R-C4-1 (cyc2375): 道具指定の実行側 reader 純粋核
import { resolvePlacement, linkedPlacementCells, placementItemIdOf } from "./placement_resolve.js"; // 0-C4 R-C4-2 (cyc2376): 設置位置の実行側 reader 純粋核
import { isCropMature, CROP_MATURITY_MAX, isCropBlock, cropBreakGate } from "./crop_maturity.js";
import { resolveWorkAccess, ACCESS } from "./work_access.js"; // 基礎 遮蔽除去 (v0.4.76): 作業アクセス解決の純粋核
import { evaluateDig } from "./dig_gate.js"; // 要望バッチA (v0.4.88): 掘削の統一ゲート
import { evaluatePlace, placeHoldRecord } from "./place_gate.js"; // PLACE-GATE段2 (cycle0522): 設置側ゲート (build配線のみ、station/torchは段3)
import { gazeRotation } from "./gaze_math.js"; // POLISH-ANIM-LOOK-01 (cycle0821): 視線ピッチ連動の純粋計算
import { applyInspectPitch, isInspectActive, shouldInspect } from "./inspect_math.js"; // POLISH-ANIM-INSPECT-01 (cycle1003): 依頼品入手時の検分 (表示層のみ)
import { applyNodPitch, isNodActive, shouldNod } from "./nod_math.js";
import { applyFlinchPitch, isFlinchActive, decideFlinch } from "./flinch_math.js"; // POLISH-ANIM-FLINCH-01 (cycle1051): 落雷・点火TNTへの身構え (表示層のみ) // POLISH-ANIM-NOD-01 (cycle1036): 納品完了時の小さな頷き (表示層のみ)
import { applySummonScanYaw, isSummonScanActive, shouldSummonScan } from "./summon_scan_math.js";
import { applyLookbackYaw, isLookbackActive, shouldLookback } from "./lookback_math.js"; // POLISH-ANIM-LOOKBACK-01 (cycle1153): 先行移動中に主人を一度だけ振り返る (表示層のみ)
import { applySkyglancePitch, isSkyglanceActive, shouldSkyglance } from "./sky_glance_math.js";
import { createHorizonState, noteHorizon, horizonCurrentOffset } from "./horizon_glance_math.js"; // POLISH-ANIM-HORIZONGLANCE-01 (cycle0320): dawn/dusk horizon glance (display only)
import { createFullMoonState, noteFullMoon, fullMoonCurrentOffset } from "./fullmoongaze_math.js"; // POLISH-ANIM-FULLMOONGAZE-01: 満月の夜に一度だけ月を見上げる (表示層のみ・実機確認待ち)
import { pickEscapeBlock, shoreNeedFor, scanShore, lavaStuckStep } from "./env02_math.js"; // ENV-02 (cycle0340): 溶岩足場脱出の知覚・出口の純粋核
import { createNightwatchState, noteNightwatch, sampleNightwatch, applyNightwatchPitch } from "./nightwatch_math.js";
import { createDoubletakeState, noteDoubletake, sampleDoubletake } from "./doubletake_math.js"; // POLISH-ANIM-DOUBLETAKE-01 (cycle0403): 主人の急接近への二度見 (表示層のみ) // POLISH-ANIM-NIGHTWATCH-01 (cycle0340): 夜間見回り視線 (表示層のみ)
import { darkEntryInit, noteDarkEntry, darkEntryOffset, darkEntryActive, lightBandOf } from "./darkentry_math.js"; // POLISH-ANIM-DARKENTRY-01 (cycle0423): 暗所入場時の見回し (表示層のみ)
import { createTorchPassState, noteTorchPass } from "./torchpass_math.js"; // POLISH-ANIM-TORCHPASS-01 (cycle1532): feeder 第1段は記録のみ (peek-only・新規走査なし)
import { createEatGlanceState, noteOwnEating, applyEatGlancePitch } from "./eatglance_math.js"; // POLISH-ANIM-EATGLANCE-01: 自分の飲食で手元へ視線を落とす (表示層のみ・実機確認待ち)
import { applyDryoffYaw, isDryoffActive, noteDryoff as noteDryoffState } from "./dryoff_math.js"; // POLISH-ANIM-DRYOFF-01 (cycle1322): 雨上がりに水を払う (表示層のみ・実機確認待ち)
import { noteBreathCold } from "./breath_cold_math.js"; // POLISH-FX-BREATHCOLD-01 (cycle1343): 寒冷地での白い排気 (表示層のみ・粒子ID未照合のため記録のみ・実機確認待ち)
import { fromCraftResult } from "./actions_contract.js"; // 6-ML (cycle1322): CRAFT/SMELT 実行結果の正規化 (記録専用)
import { fromEquipmentResult } from "./actions_contract.js"; // 6-ML (cyc1939): ATTACK (shootAt) 実行結果の正規化 (記録専用) // POLISH-ANIM-SKYGLANCE-01 (cycle1133): 雨の降り始めに空を見上げる (表示層のみ) // POLISH-ANIM-SUMMONSCAN-01 (cycle1110): 召喚・復元直後の見回し (表示層のみ)
import { createSpiral, spiralStepCell, spiralDigCells, spiralStepsTotal, spiralHeading, spiralLocateK, chooseSpiralVariant } from "./spiral.js";
import { steerDecision, collectHints, chooseHint, hintDirection, inDepthBand, SURVEY_HINT, reSteerDir } from "./survey_hint.js"; // cycle2333: R1 reSteerDir 配線 (発火点限定) // キュー7 (cycle1443): surveyヒントで坑道を誘導する純粋核 (ヒント無し時は従来ランダムへ完全フォールバック)
import { createGuardState, decideResteer, recordBlocked, recordResteerApplied, legKeyOf } from "./resteer_guard_math.js"; // cycle0005: resteer F-1/F-2 ガード純粋核 (元凶方向への復帰禁止・再blocked無効化・blocked累計30秒の出口・距離/深度ガード)
import { createWakestretchState, noteWakestretch, wakestretchCurrent, applyWakestretchPitch } from "./wakestretch_math.js"; // POLISH-ANIM-WAKESTRETCH-01 (cycle0005): 長い待機明けの小さな伸び (表示層のみ・実機確認待ち)
import { createOwnerfalltrackState, noteOwnerfalltrack, ownerfalltrackCurrent } from "./ownerfalltrack_math.js"; // POLISH-ANIM-OWNERFALLTRACK-01 (cycle0033): owner fall gaze tracking (display only)
import { createFallLandState, onVerticalStep, falllandCurrent } from "./fallland_math.js";
import { createLandEnvState, noteLandEnv, landEnvCurrent } from "./land02_math.js"; // POLISH-ANIM-LAND-02 (cycle0252): 着地表現の環境差 (記録のみ先行・実機確認待ち)
import { createRoutecheckState, noteRoutecheck, sampleRoutecheck } from "./routecheck_math.js";
import { createInspectAgg, recordInspectEval, summarizeInspectAgg, formatInspectSummaryLines } from "./goap_inspect_agg.js"; // Phase6 INSPECT S0-1 (cycle0153): 記録専用カウンタ (挙動不変) / S0-1.5 (cycle0252): 表示読み手
import { stashWorkProgress, takeStashedLeft, clearStashFor } from "./work_stash_math.js"; // A06-03 (cycle0224): r.work 差替で失われる掘削進捗の退避/復元 (純粋核)
import { createCombatEndState, noteCombatEnd, sampleCombatEnd } from "./combatend_math.js"; // POLISH-ANIM-COMBATEND-01 (cycle0224): 戦闘終了確定時の息継ぎ (表示層のみ・実機確認待ち)
import { createYieldState, noteYield, sampleYield } from "./yield_math.js"; // POLISH-ANIM-YIELD-01 (cycle0153): 狭い通路での半歩の譲り (表示層のみ・実機確認待ち) // POLISH-ANIM-ROUTECHECK-01 (cycle0117): 長距離移動中の進路確認 (表示層のみ・実機確認待ち) // POLISH-ANIM-FALLLAND-01 (cycle0057): 落下ポーズ+着地クッション (表示層のみ・実機確認待ち)
import { extractItemData, applyItemData, normalizeSavedInv } from "./inv_item_data.js"; // 0-C3 (cycle1238): 回収・再召喚で荷物の個別情報 (名前/エンチャント/消耗) を保持する
import { applyRecallcheckPitch, isRecallcheckActive, shouldRecallcheck } from "./recallcheck_math.js"; // POLISH-ANIM-RECALLCHECK-01 (cycle1238)
import { createLevelupNodState, noteOwnerLevel, applyLevelupNodPitch, isLevelupNodActive } from "./levelupnod_math.js"; // POLISH-ANIM-LEVELUPNOD-01 (cyc2059 pure core / cyc2122 feeder wiring)
import { createEndgoalState, stepEndgoal, ENDGOAL_MILESTONES } from "./endgoal_math.js"; // ENDGOAL W-A (cyc2363): 段階1 shadow feeder (記録と節目ログのみ・実行はしない)
import { createShiverState, noteShiverSample, applyShiverYaw, isShiverActive } from "./shiver_math.js"; // POLISH-ANIM-SHIVER-01 (cyc2355): 寒冷時の小刻みな震え feeder (表示層のみ・実機確認待ち)
import { createChestGlanceState } from "./chestglance_math.js"; // POLISH-ANIM-CHESTGLANCE-01 (cyc2363): 純粋核先行・記録のみ (feeder 未接続のため発火しない)
import { createHeedState, noteHeed as noteHeedState, sampleHeed } from "./heed_math.js";
import { createThresholdState, noteThreshold as noteThresholdState, sampleThreshold } from "./threshold_math.js"; // POLISH-ANIM-THRESHOLD-01 (cycle1503): くぐり視線 (表示層のみ・実機確認待ち)
import { createEdgepeekState, noteEdgepeek as noteEdgepeekState, sampleEdgepeek } from "./edgepeek_math.js";
import { createIcebalanceState, noteIcebalance as noteIcebalanceState, sampleIcebalance } from "./icebalance_math.js";
import { createSnowtreadState, noteSnowtread, snowtreadCurrentOffset, applySnowtreadPitch } from "./snowtread_math.js"; // POLISH-ANIM-SNOWTREAD-01 (cycle2333): 雪上歩行の小さな沈み込み (表示層のみ・実機確認待ち)
import { createStepupState, noteStepup as noteStepupState, sampleStepup } from "./stepup_math.js";
import { banKeyFor, matchesBan, isBanned, filterBanned, isTrunkType, entityBanKey, isEntityBanned } from "./trunk_ban.js"; // queue0-A bug2 (cycle1728, v0.5.19): trunk-unit ban // HUNT-BAN-CELL-01 (cyc2385): 実体 ban は ID 単位
import { treeNeighbors, mergeTreeCands } from "./tree_cont_math.js"; // 0-D3 R1 (cycle0583): 同じ木の継続候補
import { resolveTrunkBase } from "./trunk_descent_math.js"; // 0-C R-C6-2 (cyc2391): 幹下降補正の純粋核 (横枝から幹最下段へ)
import { createTakeBanState, recordTakeBan, isTakeBanned, pruneTakeBans, clearAllTakeBans } from "./take_ban_math.js"; // TR2136-01 (cycle2200): 回収全量失敗の実行側見切り
import { createWorkBanState, recordWorkBan, isWorkBanned, pruneWorkBans, filterWorkBanned } from "./work_ban_math.js"; // cycle0832 F5: work層の見切り ban (hold枯渇後に到達不能候補を選び直す無限ループの是正)
import { createOreSpotState, noteOreSpot, sampleOreSpot } from "./orespot_math.js"; // POLISH-ANIM-ORESPOT-01 (cycle0832): 貴重鉱石への二度見 (表示層のみ・実機確認待ち)
import { createHomesightState, noteHomesight, sampleHomesight } from "./homesight_math.js"; // POLISH-ANIM-HOMESIGHT-01 (cycle0900): 拠点が見える距離まで帰ってきたときの小さな頷き (表示層のみ・実機確認待ち)
import { createSleepwatchState, noteSleepwatch, sampleSleepwatch, sleepwatchYawPullDeg } from "./sleepwatch_math.js"; // POLISH-ANIM-SLEEPWATCH-01 (cycle0910): 主人が眠り始めた瞬間に一度だけ頭を向け直す見守り視線 (表示層のみ・実機確認待ち)
import { createMountglanceState, noteMountglance, sampleMountglance, mountglanceYawPullDeg } from "./mountglance_math.js"; // POLISH-ANIM-MOUNTGLANCE-01 (cycle0936): 主人が乗り物に跨った瞬間に一度だけ頭を向け直す出発の見届け視線 (表示層のみ・実機確認待ち)
import { createWakegreetState, noteWakegreet, sampleWakegreet, wakegreetYawPullDeg } from "./wakegreet_math.js"; // POLISH-ANIM-WAKEGREET-01 (cyc1939): 主人が目覚めた瞬間に一度だけ向け直す小さな会釈 (表示層のみ・実機確認待ち)
import { createWorkglanceState, noteWorkglance, sampleWorkglance } from "./workglance_math.js"; // POLISH-ANIM-WORKGLANCE-01 (cycle1728, v0.5.19)
import { createCatchsightState, noteCatchsight, sampleCatchsight } from "./catchsight_math.js";
import { createRainShelterState, noteRainShelter, sampleRainShelter } from "./rainshelter_math.js"; // POLISH-ANIM-RAINSHELTER-01 (cycle2231): 持続雨の待機中に屋根方向へ視線を寄せる (表示層のみ・実機確認待ち) // POLISH-ANIM-CATCHSIGHT-01 (cycle2200): 主人が投げた物の追視 (表示層のみ・実機確認待ち)
import { notePortalsteady, portalsteadyOffsetsAt, isPortalsteadyActive } from "./portalsteady_math.js";
import { createSurfacebreathState, stepSurfacebreath, sampleSurfacebreath, applySurfacebreathPitch } from "./surfacebreath_math.js"; // POLISH-ANIM-SURFACEBREATH-01 (cycle1703)
import { createBubblebreathState, stepBubblebreath } from "./bubblebreath_math.js"; // POLISH-FX-BUBBLEBREATH-01 (cycle1909): 水中滞在中の冷却排気泡 (粒子ID未照合の間は記録のみ・実機確認待ち)
import { tickToolCheck, createToolCheckState } from "./toolcheck_math.js";
import { createVillagergreetState, noteVillagergreet, sampleVillagergreet } from "./villagergreet_math.js"; // POLISH-ANIM-VILLAGERGREET-01 (cycle0855): 村人とすれ違うときの小さな会釈 (表示層のみ・実機確認待ち)
import { createWarmhandsState, noteWarmhands, sampleWarmhands } from "./warmhands_math.js"; // POLISH-ANIM-WARMHANDS-01 (cycle0740) // POLISH-ANIM-TOOLCHECK-01 (cycle1807): 長時間待機中に一度だけ手元の道具を点検する (表示層のみ・実機確認待ち)
import { createLoadPostureState, noteLoadPosture, sampleLoadPosture } from "./loadposture_math.js";
import { createPartnerCheckState, notePartnerCheck, partnerCheckOffset } from "./partnercheck_math.js";
import { createEnderavertState, noteEnderavert, sampleEnderavert } from "./enderavert_math.js"; // POLISH-ANIM-ENDERAVERT-01 (cycle1940): 表示層のみ・実機確認待ち
import { createSurveyLatch, recoverSurveyLatch, surveyLatchAvailable, tripSurveyLatch, applySurveyChunkOutcome, shouldTripGlobalLatch, pruneGlobalErrorEvents } from "./survey_broken.js"; // SURVEY-BROKEN-PERMANENT 是正 (cycle0628): 進捗で fails リセット＋区画隔離＋全体ラッチのクールダウン回復
import { createXpGlanceState, noteXpGlance, sampleXpGlance, blendXpGlanceGaze } from "./xpglance_math.js"; // POLISH-ANIM-XPGLANCE-01 (cycle0628): 表示層のみ・実機確認待ち
import { restoreForbids, mergeSessionForbids, serializeForbids, forbiddenTargetIds, unionForbiddenIds, normForbiddenId, isForbiddenWorkTarget, removeSessionForbids, recomputeForbiddenIds, deriveBaseForbiddenIds } from "./session_forbids.js"; // cycle0505: forbids G4 record 側の正規化 // cycle0117: G2/G6-b 読み手 (unionForbiddenIds/forbiddenTargetIds) // Phase5 (cycle1923): sessionForbids の復元純粋核 / 読み手R1 (cycle2006) / 保存の単一形 (cycle2036)
import { createMusicnodState, noteMusicnod, sampleMusicnod } from "./musicnod_math.js"; // POLISH-ANIM-MUSICNOD-01 (cycle2006): 表示層のみ・実機確認待ち
import { createIdleState, noteIdle, sampleIdle } from "./idle_math.js"; // POLISH-ANIM-IDLE-01 (cycle2020): 待機モーション (表示層のみ・実機確認待ち)
import { createLookLeadState, tickLookLead } from "./looklead_math.js"; // POLISH-ANIM-LOOKLEAD-01 (cycle2036): 作業対象への視線の先行 (表示層のみ・実機確認待ち)
import { applySettlePitch, isSettleActive, shouldSettle } from "./settle_math.js"; // POLISH-ANIM-SETTLE-01 (cycle2058): 掘削完了直後の小さな確認視線 (表示層のみ・実機確認待ち)
import { applyPlacesettlePitch, isPlacesettleActive, shouldPlacesettle } from "./placesettle_math.js"; // POLISH-ANIM-PLACESETTLE-01 (cycle2248): 設置完了直後の小さな確認視線 (表示層のみ・実機確認待ち)
import { applyCraftsettlePitch, isCraftsettleActive, shouldCraftsettle } from "./craftsettle_math.js"; // POLISH-ANIM-CRAFTSETTLE-01 (cycle0141): 製作/精錬完了直後の小さな確認視線 (表示層のみ・実機確認待ち)
import { createDeliverGuardState, noteDeliverOutcome, isDeliverCooling } from "./deliver_guard_math.js";
import { createDepositGuardState, noteDepositOutcome, isDepositCooling, nextDepositDeliverFail, planDepositDecision, noteDepositCoolEdge, resetDepositCoolCycles } from "./deposit_guard_math.js"; // cycle0740: planDepositDecision 配線 (deposit_at_home) // cycle0659: deposit F1/F3 guard // cycle0900: DEPOSIT-SUPPRESS-AND-GATE 是正 (冷却エッジ計数)
import { ownerLavaNearFromIds, lavaBelowFromIds, LAVA_BELOW_SCAN } from "./lava_detect_math.js"; // cycle0721: LAVA-01/02 検知分離 // A18-TR-01 (cycle0446): planner deliver_to_owner 満杯失敗の出口 (連続全滅3回で60秒冷却し他 goal へ譲る)
import { applyDeliverBowPitch, isDeliverBowActive, shouldDeliverBow } from "./deliverbow_math.js"; // POLISH-ANIM-DELIVERBOW-01 (cycle0446): 手渡し成功直後の小さな会釈 (表示層のみ・実機確認待ち)
import { applyStoresettlePitch, isStoresettleActive, shouldStoresettle } from "./storesettle_math.js";
import { applyNospaceYaw, isNospaceActive, shouldNospace } from "./nospace_math.js"; // POLISH-ANIM-NOSPACE-01 (cycle0537): 満杯で拾えない辺の小さな首振り (表示層のみ・実機確認待ち)
import { createBuildGateHoldState, noteBuildGateHold, clearBuildGateHold, buildGateHoldKey, createBuildGateSkipStreakState, noteBuildGateSkipStreak, clearBuildGateSkipStreak } from "./build_gate_hold_math.js"; // BUILD-GATE-HOLD (cycle0553): 建築 gate hold の累計45秒見切り (セル単位で skip し300秒全体終端だけに頼らない) + BUILD-FLOOR-SELF-01 (cyc2368): 同一 why の skip 反復を全体で数える
import { createLowCeilDuckState, noteLowCeilDuck, sampleLowCeilDuck } from "./lowceilduck_math.js"; // POLISH-ANIM-LOWCEILDUCK-01 (cycle0553): 低天井下の小さなかがみ込み持続姿勢 (表示層のみ・実機確認待ち)
import { createStowState, noteStowWork, noteStowTick, applyStowPitch, isStowActive, STOW_MAX_ARM_DEG } from "./stow_math.js"; // POLISH-ANIM-STOW-01 (cycle0522): 作業セッション終了時の道具をしまう仕草 (表示層のみ・実機確認待ち) // POLISH-ANIM-STORESETTLE-01 (cycle0505): 格納成功直後の小さな収納の仕草 (表示層のみ・実機確認待ち)
import { collectInvDurability } from "./inv_durability.js"; // cycle2311: 耐久予備ポリシーへの invDurability 供給者
import { createSwapSoundState, noteHeldItem } from "./swap_sound_math.js"; // POLISH-FX-SWAP-01 (cycle2311): 持ち替え音の発火決定 (記録のみ・実機確認待ち)
import { createOwnerReturnState, noteOwnerReturn, ownerReturnOffset } from "./ownerreturn_math.js"; // POLISH-ANIM-OWNERRETURN-01 (cycle1923): 帰還の気付き (表示層のみ・実機確認待ち) // POLISH-ANIM-PARTNERCHECK-01 (cycle1850): 主人被弾の辺で無事確認の視線 (表示層のみ・実機確認待ち)
import { deriveInspectNeeds } from "./goap_inspect.js"; // Phase6 UNKNOWN→INSPECT段1 (cycle1850): 影記録。読み手は 6-ML 層1 (cycle1940) で source スコープ限定・記録のみ接続済み // POLISH-ANIM-LOADPOSTURE-01 (cycle1832): 満載が続くと小さく前傾する (表示層のみ・実機確認待ち)
import { createMoveTracker, moveTrackStep, drainMoveEvents } from "./move_state.js"; // ground-walk Stage 0-B (cycle1703): record-only wiring // POLISH-ANIM-PORTALSTEADY-01 (cycle1640): 次元移動直後の立て直し (表示層のみ・実機確認待ち) // POLISH-ANIM-STEPUP-01 (cycle1603): 1マス段差を上る瞬間の小さな前傾 (表示層のみ・実機確認待ち) // POLISH-ANIM-ICEBALANCE-01 (cycle1543): 氷上のバランス取り (表示層のみ・実機確認待ち)
import { materialOfTypeId } from "./sfx.js"; // cycle1543: ICEBALANCE の足元カテゴリ供給 (分類の単一の正は sfx.js) // POLISH-ANIM-EDGEPEEK-01 (cycle1518): 段差手前の覗き込み視線 (表示層のみ・実機確認待ち) // POLISH-ANIM-HEED-01 (cycle1443): 主人の発言の辺で頭だけを向ける (表示層のみ・実機確認待ち) // 要望バッチB (v0.4.90): 螺旋階段の純粋幾何
import { pickaxeItemForLevel } from "./bootstrap.js"; // cycle0942: toolNeed 消費点の等級→ツルハシ決定
import { createResidueState, residueTick, emitResidueParticle } from "./env_residue.js"; // POLISH-FX-ENVRESIDUE-01 (cycle0942): 環境残留表現の状態機械 (パーティクルID未照合の間は記録のみ)
import { createSfxState, sfxDigHit, sfxDigBreak, sfxStep, sfxPlace, sfxPickup, sfxSplash, sfxEat, sfxAttack, sfxLand, sfxHurt } from "./sfx.js"; // POLISH-SND-LAND-01/HURT-01 (cycle0942): 着地音・被弾音も配線 // POLISH-SND-SWIM-01 (cycle0731): 入水/出水音も配線 // POLISH-SND-PICKUP-01 (cycle0710): 回収音も配線 // 要望バッチF (v0.4.88): 素材別サウンド
import { findSources, planFor, entitySourceIds } from "./sourcing.js";
import { huntKillCounts, nearestEntityOfType } from "./hunt_math.js"; // HUNT-ANIMAL-PROGRESS-01 / HUNT-NEAREST-01 (cyc2385): 討伐計上の門と最寄り選択の純粋核
import { createMission, advance, missionSummary, withdrawKeyOf, STEP_TYPES } from "./mission.js";
import { selectWithdrawCandidate, candKeyForFirstStep } from "./withdraw_candidate.js"; // Phase3 candKey B1 (v0.4.26): 候補選定・射影の純粋関数
import { scanOpportunities, noteAttempt, pruneCooldowns } from "./side_tasks.js";
import { createSideChase, chaseTick, sideChaseRangeFor } from "./side_chase.js"; // SIDE-COOLDOWN-CHASE (cycle1134): 接近保持と終端クールダウン
import { gateCancel, gateFactory, gateWarehouseSort, gateTeachItemDest, isHowToRequest } from "./chat_gate.js"; // 0-C1 (cycle1155): 質問・否定・仮定・部分スコープでは中止/工場/指示を発火しない共通ゲート
import { pickNearest as veinPickNearest, veinNeighbors, capVeinCands, sameResource as veinSameResource } from "./vein_math.js";
import { fillDefOf, selectFillMedium, checkFillPreconditions, verifyFillPost, fillRunsNeeded, isSourceMediumCell, selectSafeFillStand, fillStandUnsafe } from "./fill_math.js"; // 0-C R-C4-4 S3 (cyc2381): 充填媒体の探索判定 (純粋核) // 0-D1 (cycle1400): 鉱脈継続・距離優先の純粋核
import { classifyDescent as d2Classify, ensureSpiralAnchor as d2EnsureAnchor, spiralStepAt as d2StepAt, spiralStepIndexAt as d2StepIndexAt, resolveSpiralDesync as d2Desync } from "./d2_spiral_math.js"; // 0-D2 (cycle1434): 発見後も螺旋降下 / G2 (cyc2363): 起点は ensure で固定し対象キーで作り直さない
import { allowedLogIds, countLogsForTarget } from "./tree_species_math.js";
import { createWideScanFails, partitionWideIds, noteWideSuccess, noteWideIdFailure, noteWideGlobalFailure, wideIdBlocked } from "./wide_scan_fails.js"; // 0-D4 Bprime (cycle1455): wide scan failures isolated per typeId
import { isAllowedByAllowOnly, isBuildAllowedByAllowOnly, serializeAllowOnly, restoreAllowOnly, clearAllowOnly } from "./allow_only.js"; // 0-C2 reader (cycle1455): allowOnly enforcement // 0-D3: 樹種指定時は対象選択・進捗をその樹種だけに限定する
import { shouldReplayGaze, GAZE_REPLAY_INTERVAL_TICKS } from "./gaze_cadence_math.js"; // 0-E1 GAZE-CADENCE-01: 視線レイヤーを本体ループから分離する
import { mergeCaps, capForTarget, serializeCaps, restoreCaps } from "./cap_guard_math.js"; // 0-C2 読み手 (cycle1337): セッション上限を mission へ届ける // cyc2020: caps の DP 永続化 (cb_caps)
import { createWarehouseRegistry, serializeWarehouseRegistry, deserializeWarehouseRegistry, addCandidates, warehouseKeyOf, registerBox, removeCandidate, teachItemDest, markNeedsRecheck, confirmBox, canonicalKeyOf } from "./warehouse_registry.js"; // cyc2367 WH-RECHECK-01 // 倉庫 W1: 台帳の DP 永続化 (cb_warehouse)
import { WAREHOUSE_CATEGORIES, categoryLabelOf } from "./warehouse_categories.js"; // 倉庫 W1 (cyc1908): 仕分け先カテゴリ語彙の単一の正。UI 登録で category を渡し、仕分け核の category 一致を実運用で発火させる
import { planSortMoves } from "./warehouse_sort.js"; // 倉庫 W2 (cyc1939): 仕分け計画核を実機経路へ接続
import { verifyMove } from "./warehouse_exec.js"; // 倉庫 W2 (cyc1939): 移動直前のスロット再確認
import { itemSnapshotOf, boxSnapshotOf, buildSortInput, summarizeSort } from "./warehouse_adapter.js"; // 倉庫 W2 (cyc1939): 実コンテナ⇔boxes 形式の変換
import { createStairLookState, noteStairLook, stairLookPitch } from "./stairlook_math.js"; // POLISH-ANIM-STAIRSLOOK-01 (cycle1455): 表示層のみ・実機確認待ち
import { createOrderLookState, noteOrderAccepted, sampleOrderLook } from "./orderlook_math.js"; // POLISH-ANIM-ORDERLOOK-01: 指示受理直後の「受けました」の頷き (表示層のみ・実機確認待ち)
import { createHomebowState, noteHomeArrival, sampleHomebow } from "./homebow_math.js"; // POLISH-ANIM-HOMEBOW-01 (cyc1908): 拠点入庫完了直後の小さな一礼 (表示層のみ・実機確認待ち)
import { evalCondition, conditionExpired, isEvaluableCondition, conditionRole, evalWindowEnd } from "./condition_math.js"; // 0-C2 読み手 (cycle1337): 条件付き注文の発火判定。R-C2-4 (cyc2380): window 終了判定
import { serializePendingCondition, deserializePendingCondition, normalizePendingCondition } from "./pending_condition_math.js"; // E-01 (cycle1722): 条件保留を DP cb_pending_condition へ永続化し、再起動・回収・死亡での無言消失を防ぐ
import { detectUnsupportedIntent } from "./unsupported_intent.js"; // 0-C7 (cycle1337): 未対応依頼への明示返答ゲート
import { BLUEPRINTS, buildOrderOf, materialsSummaryOf, resolveMaterialItem } from "./blueprints.js";
import { designFactory, GOAL_ALIASES } from "./factory_design.js";
import { simulate } from "./factory_sim.js";
import { layoutToBuild } from "./layout_build.js";
import { understand } from "./understanding.js";
import { arbitrate, adaptOrder, adaptQA, adaptTool, adaptKnowledge, adaptChat, adaptFollowup } from "./chat_arbiter.js";
import { createConversation } from "./conversation.js";
import { composeFallback } from "./composer.js";
import { answerQuestion } from "./grounded_qa.js";
import { tryTool } from "./chat_tools.js";
import { tryMath } from "./math_tools.js";
import { lookupAll, detectLatestTopic, pickHonestyLine } from "./knowledge/index.js";
import { createNav, navSetGoal, navClearGoal, navTick, classifyTypeId, solidOfTypeId, cellUnknown, yawToward, isSafeTeleportDest } from "./nav.js";
import { guardedTeleport } from "./teleport_gate.js";
import { createFly, flySetGoal, flyClearGoal, flyTick } from "./fly.js";
import { planLongTask, countOfGroup, legMissionTarget, legLabel, mineDepthFor } from "./longtask.js";
import { executeCraftLeg, executeSmeltLeg, consumeFrom, addTo } from "./crafting.js";
import { openEquipUI } from "./equip_ui.js";
import { createEquipCore, createEquipmentApi, durabilityPcts } from "./equip_api.js";
import { createTrace, mapGoalEvent, mapPlanEvent, mapReplanEvent, mapInterruptAct, shouldRecordAct, formatTraceSummaryLines } from "./trace.js"; // Phase4 cb_trace (v0.4.56): 判断トレースの器 (記録専用)。v0.4.57: goal/plan 配線を追加。v0.4.60: replan 配線を追加。v0.4.62: 表示 U1 (selection 6 のみ)。v0.4.65: act 配線を追加
import { createFailAgg, recordAction, recordNote, formatFailSummaryLines, serializeFailAggShards, restoreFailAggShardsWithReport, planShardWrites, failRate } from "./fail_vocab.js"; // Phase4 failAgg (v0.4.64): 失敗集計の純粋核。記録は noteFail/commitLastAction の内側2点だけ (S2)。読み手は状態表示のみ (S3a)。v0.4.77: S3b 永続化 (cb_failagg キー分割)
import { pickSurveyEvictions } from "./survey_evict.js"; // survey 案C (cycle2006): 容量削除の複合キー純粋核
import { recordHitReservoir } from "./survey_reservoir.js"; // survey 案R (cycle2036): リザーバサンプリング純粋核
import { dropTupleForBlock } from "./block_drops.js";
import { isUndergroundColumn } from "./underground_math.js"; // キュー0副次 (cycle1400): 地下判定の数え上げを純粋核へ (雪層は地形に数えない規則を回帰テストで固定)
import { applyTossPitch, isTossActive, shouldToss } from "./toss_math.js"; // POLISH-ANIM-TOSS-01 (cycle1400): アイテム出現時の投げ出し表現 (表示層のみ・実機確認待ち)
import { createMirrorState, recordEdge as recordMirrorEdge } from "./mirror_math.js"; // POLISH-ANIM-MIRROR-01 (cycle1421): 主人の身振りへのお返し動作の純粋核。当面は記録のみ (辺の検証が構造的に不可能なため、cycle1421-a20)
import { createExpStore, addExpRecord, buildExpFromCommit, buildExpFromNoteFail, expCtxOf, serializeExpStore, restoreExpStore, expBytes } from "./exp_recorder.js"; // Phase7準備 6-ML (cycle0710): 経験記録のみ・挙動不変。6-ML5 export は配線しない // 基礎 N1 (v0.4.65): 決定的 block 源の獲得は sourcing の dropItem が正 (block_drops が逆引き)

const DIMS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
let _entitySourceIdSet = null; // HUNT-SCAN-BUCKET-01 (cyc2385): sourcing の entity 供給源ID集合 (遅延生成・走査の受け皿)
function entitySourceIdSet() { if (!_entitySourceIdSet) { try { _entitySourceIdSet = entitySourceIds(); } catch { _entitySourceIdSet = new Set(); } } return _entitySourceIdSet; }
const bots = new Map(); // botId -> runtime
const ownerRt = new Map(); // playerId -> {breakAt, placeAt, spawnAt, lastDay}
let tick = 0;

const dp = (e, k, fb) => { try { const v = e.getDynamicProperty(k); return v === undefined ? fb : v; } catch (err) { noteFail(e, "dp:" + k, err); return fb; } };
const dps = (e, k, v) => { try { e.setDynamicProperty(k, v); } catch (err) { noteFail(e, "dps:" + k, err); } };
// E-01 (cycle1722): 条件保留の保存・消去はこの2本に集約する (メモリと DP を必ず同時に更新し、片方だけ残して復活・消失させない)
function setPendingCondition(bot, r, pend) { try { const n = normalizePendingCondition(pend); r.pendingConditionOrder = n || pend; dps(bot, "cb_pending_condition", serializePendingCondition(pend)); } catch {} } // A01 R-1: メモリ側も保存形 (正規化済み) に揃え、往復で形が変わらないようにする
function clearPendingCondition(bot, r) { try { r.pendingConditionOrder = null; dps(bot, "cb_pending_condition", ""); } catch {} } // A01 R-3: メモリが既に null でも DP 残骸を必ず掃除する
// 失敗の可視化（v0.4.1）: 握り潰す代わりに記録する。本人の文脈（c.x.lastFail）と状態表示に戻し、
// 開発中は [LIZE DEBUG] ログも残す（同じ失敗は初回3回＋20回ごとだけ出してログを埋めない）。
const failStats = { total: 0, byWhere: {} };
// cycle0955 (Phase4): fail 文脈 snap 受け渡し (記録のみ、x は材料が無いため null のまま)
function noteFail(bot, where, err, opts) {
  failStats.total++; failStats.byWhere[where] = (failStats.byWhere[where] || 0) + 1;
  const msg = err && err.message ? String(err.message).slice(0, 120) : String(err || "");
  const r = bot ? bots.get(bot.id) : null;
  if (r) { r.failCount = (r.failCount || 0) + 1; r.lastFail = { where, msg, at: Date.now() }; (r.failLog = r.failLog || []).push(r.lastFail); if (r.failLog.length > 20) r.failLog.shift(); try { r.trace?.recordFail({ where, msg }, { g: r.goal ?? null, p: mapPlanEvent(r.lastPlan, r.lastGoal)?.p ?? null, a: r.lastAction?.act ?? null }); } catch {} try { if (r.failAgg) recordNote(r.failAgg, where, msg, Date.now()); } catch {} try { if (r.expStore && !opts?.expDone) { const er = buildExpFromNoteFail(where, msg, { at: Date.now(), pack: VERSION }); if (er) addExpRecord(r.expStore, er); } } catch {} } // 6-ML: fail軸の記録 (内部キーはモジュール側で落ちる)
  if (LIZE_DEBUG) { const n = failStats.byWhere[where]; if (n <= 3 || n % 20 === 0) console.warn(`[LIZE DEBUG] v${VERSION} ${where} failed (${n}): ${msg}`); }
}
// Phase2 BTS記録 (v0.4.7): BREAK/TAKE/STORE の結果を契約形で r.last* へ記録する (記録のみ、挙動不変)。
// 失敗の集計は noteFail へ一本化し、last* は直近結果の射影に留める (a17/a20 裁定)。
// Phase2 lastAction (v0.4.9): 既存 r.last* を正として維持し、その正規化ミラーを r.lastAction へ追加記録するだけ (挙動不変、読み手は Phase 4)。
// Phase4 failAgg S3b (v0.4.77): 永続化の dirty 判定はスナップショット比較 (総数3件+両テーブル件数)。
// serialize は flush 時のみ (tick 経路では行わない)。gen は成否判定が構造的に不可能なため前進させる
// (書けていなければ復元側が世代/ハッシュ不一致で空開始に倒れる。cycle0238-a04 §4-2)。
function failAggSnapshot(r) { try { const a = r && r.failAgg; if (!a) return ""; return [a.actionTotal | 0, a.actionFail | 0, a.noteTotal | 0, Object.keys(a.byReason || {}).length, Object.keys(a.byWhere || {}).length].join("|"); } catch { return ""; } }
function flushFailAgg(bot, r) { try { if (!bot || !r || !r.failAgg) return; const snap = failAggSnapshot(r); if (!snap || snap === r.failAggSnap) return; const gen = (Number.isInteger(r.failAggGen) ? r.failAggGen : 0) + 1; const out = serializeFailAggShards(r.failAgg, { gen }); if (!out) return; const plan = planShardWrites(r.failAggWrites, out.writes); for (const k of plan.del) dps(bot, k, ""); for (const [k, v] of Object.entries(plan.set)) if (k !== "cb_failagg") dps(bot, k, v); if (plan.set["cb_failagg"]) dps(bot, "cb_failagg", plan.set["cb_failagg"]); r.failAggGen = gen; r.failAggWrites = out.writes; r.failAggSnap = snap; } catch {} }
// 6-ML (cycle0710): exp 永続化。failAgg と同型 (dirty は件数+バイト数の簡易スナップショット比較、保存失敗で noteFail を呼ばない=再帰防止)
function expSnapshot(r) { try { const st = r && r.expStore; if (!st) return ""; return [st.items.length, expBytes(st)].join("|"); } catch { return ""; } }
function flushExp(bot, r) { try { if (!bot || !r || !r.expStore) return; const snap = expSnapshot(r); if (!snap || snap === r.expSnap) return; const gen = (Number.isInteger(r.expGen) ? r.expGen : 0) + 1; const out = serializeExpStore(r.expStore, { gen }); if (!out) return; const prev = r.expWrites || {}; for (const k of Object.keys(prev)) if (!(k in out.writes)) { try { bot.setDynamicProperty(k, ""); } catch {} } for (const [k, v] of Object.entries(out.writes)) if (k !== "cb_exp") { try { bot.setDynamicProperty(k, v); } catch {} } if (out.writes["cb_exp"]) { try { bot.setDynamicProperty("cb_exp", out.writes["cb_exp"]); } catch {} } r.expGen = gen; r.expWrites = out.writes; r.expSnap = snap; } catch {} }
function commitLastAction(r, rec) { try { if (!r || !rec) return; r.actionSeq = (r.actionSeq || 0) + 1; r.lastAction = { act: rec.act || null, ok: !!rec.ok, reason: rec.reason || null, item: rec.item || null, at: rec.at || Date.now(), seq: r.actionSeq }; try { const trec = { k: "result", a: rec.act || null, r: rec.ok ? "ok" : "ng" }; if (!rec.ok && typeof rec.reason === "string" && rec.reason) trec.fr = { w: rec.act || null, m: rec.reason }; r.trace?.record(trec); } catch {} try { if (r.failAgg) recordAction(r.failAgg, rec, r.actionSeq); } catch {} try { if (r.expStore) { const er = buildExpFromCommit(rec, expCtxOf(r, rec, { pack: VERSION })); if (er) addExpRecord(r.expStore, er); } } catch {} } catch {} } // 6-ML: result軸の記録 (戻り値は使わない)
// 6-ML U4 (cyc2364 A17再整形): MOVE の終端記録 (記録のみ・挙動不変)。到着=成功は目標座標キーで1回だけ、例外=失敗は同一目標+理由で5秒間引き。ground 委譲は in_progress であり失敗として記録しない。
function recordMoveExp(r, outcome, via) {
  try {
    if (!r || !outcome) return;
    const t = r.target; if (!t) return;
    const goalKey = [Math.floor(t.x), Math.floor(t.y || 0), Math.floor(t.z), via].join(",");
    if (outcome.ok) { if (r.expMoveDoneKey === goalKey) return; r.expMoveDoneKey = goalKey; }
    else { const fk = goalKey + "|" + (outcome.reason || ""); if (r.expMoveFailKey === fk && Date.now() - (r.expMoveFailAt || 0) < 5000) return; r.expMoveFailKey = fk; r.expMoveFailAt = Date.now(); }
    r.lastMove = { act: "MOVE", ok: !!outcome.ok, reason: outcome.ok ? null : (outcome.reason || null), item: null, via: via || null, at: Date.now() };
    commitLastAction(r, r.lastMove);
  } catch {}
}
// 6-ML U4: EQUIP の成否記録 (記録のみ・挙動不変)。理由は fromEquipmentResult で契約語彙へ正規化する。
function recordEquipExp(r, res, via) {
  try {
    if (!r || !res || typeof res !== "object") return;
    const norm = fromEquipmentResult(res, "setEquip");
    const item = (res.item && typeof res.item === "object") ? (res.item.typeId || null) : (typeof res.item === "string" ? res.item : (typeof res.typeId === "string" ? res.typeId : null));
    r.lastEquip = { act: "EQUIP", ok: !!norm?.ok, reason: norm?.ok ? null : (norm?.reason || null), item, via: via || "equip_core", at: Date.now() };
    commitLastAction(r, r.lastEquip);
  } catch {}
}
function recordTake(r, via, o) { try { r.lastTake = { act: "TAKE", via, ok: !!o.ok, reason: o.reason || null, taken: o.taken || 0, partial: !!o.partial, item: o.item || null, at: Date.now() }; commitLastAction(r, r.lastTake); } catch {} }
function noteTakeFull(bot, r, key, typeId) { const now = Date.now(); if (r.takeFullKey === key && now - (r.takeFullAt || 0) < 60000) return; r.takeFullKey = key; r.takeFullAt = now; noteFail(bot, "bts_take:inventory_full", new Error("inventory full: " + typeId)); }
function noteTakeBan(r, entityId, typeId) { try { if (!r.takeBan) r.takeBan = createTakeBanState(); recordTakeBan(r.takeBan, entityId, typeId, Date.now()); } catch {} } // TR2136-01 (cycle2200): 記録専用 (noteFail は呼ばない＝失敗ログの二重計上をしない)
function recordStore(r, kind, res) { try { const moved = res?.moved || 0; const failed = !!res?.failed; const partial = failed && moved > 0; // Phase2 STORE語彙是正 (v0.4.11, cycle-1001 a06 裁定): ok/reason は契約 REASONS のみ。空振りは失敗でなく ok+detail.empty、部分移送は ok+detail.partial、全滅は INVENTORY_FULL+detail.side:"target"。量と完全性は detail へ分離する
  r.lastStore = { act: "STORE", kind, ok: moved > 0 || !failed, reason: moved === 0 && failed ? "INVENTORY_FULL" : null, moved, partial, detail: { empty: moved === 0 && !failed, partial, side: moved === 0 && failed ? "target" : null }, at: Date.now() }; commitLastAction(r, r.lastStore); } catch {} }
function recordWithdraw(bot, r, res) { try { const d = res?.detail || {}; r.lastWithdraw = { act: "WITHDRAW", ok: !!res?.ok, reason: res?.reason || null, taken: d.taken || 0, partial: !!d.partial, item: d.item || null, at: Date.now() }; commitLastAction(r, r.lastWithdraw); if (res && !res.ok && res.reason) noteFail(bot, "bts_withdraw:" + String(res.reason).toLowerCase(), new Error("withdraw failed: " + res.reason), {expDone: true}); } catch {} }
const wdp = (k, fb) => { try { const v = world.getDynamicProperty(k); return v === undefined ? fb : v; } catch { return fb; } };
const wdps = (k, v) => { try { world.setDynamicProperty(k, v); } catch {} };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function getPlayer(id) { for (const p of world.getAllPlayers()) if (p.id === id) return p; return null; }
const botByOwner = new Map(); // ownerId -> { bot, at }（Phase 0 負荷対策: findBotEntity のキャッシュ）
const BOT_MISS_TTL_MS = 5000;  // 「Botなし」結果の保持時間
function findBotEntity(ownerId, force = false) {
  const ent = botByOwner.get(ownerId);
  if (!force && ent) {
    if (ent.bot) {
      let alive = false;
      try { alive = typeof ent.bot.isValid === "function" ? ent.bot.isValid() : !!ent.bot.isValid; } catch { alive = false; }
      if (alive) return ent.bot;
      botByOwner.delete(ownerId); // 死んでいる参照は捨てて実走査へ
    } else if (Date.now() - ent.at < BOT_MISS_TTL_MS) {
      return null;
    }
  }
  for (const d of DIMS) { try { for (const e of world.getDimension(d).getEntities({ type: BOT_ID })) if (dp(e, "cb_owner", "") === ownerId) { botByOwner.set(ownerId, { bot: e, at: Date.now() }); return e; } } catch {} }
  botByOwner.set(ownerId, { bot: null, at: Date.now() });
  return null;
}
function invOf(e) { try { return e.getComponent("minecraft:inventory")?.container; } catch { return null; } }
function hpOf(e) { try { const h = e.getComponent("minecraft:health"); return { cur: h.currentValue, max: h.effectiveMax || h.maxValue || 20 }; } catch { return { cur: 20, max: 20 }; } }
// RR-05 (cycle1303): 実測できた HP だけを返す。再開判定は未実測 (UNKNOWN) を満タンと読まない
function hpOfMeasured(e) { try { const h = e.getComponent("minecraft:health"); if (!h) return null; const cur = h.currentValue, max = h.effectiveMax || h.maxValue || 20; if (!Number.isFinite(cur) || !Number.isFinite(max) || max <= 0) return null; return { cur, max }; } catch { return null; } }
const SUSPEND_RESUME_WAIT_MS = 180000;
const PLAIN_SUSPEND_WAIT_MS = 600000; // cycle0606: 単発 suspended 6理由の期限 (10分)。再開でなく終了掃除への出口
const PLAIN_SUSPEND_REASONS = new Set(["hostile_stuck", "cannot_return", "no_progress", "cannot_reach_area", "target_not_found", "unknown_step"]);
const F1_NO_PROGRESS_RESUME_LIMIT = 3; // cycle0033 F1: progress-less resume cutoff
const F1_SUSPEND_TOTAL_BACKSTOP = 30; // cycle0033 F1: backstop via persisted suspendCount // RR-05: cannot_recover の回復待ち上限 (出口のない恒久 suspended を作らない)
// RR-05 (cycle1303): cannot_recover で suspended な mission の再開/待ち/期限切れを集約する唯一の担い手。
// 戻り値: null=対象外 / "resumed"=HP実測で比>=0.5 を確認し再開 / "waiting"=期限内は破棄しない / "expired"=期限超過 (終了掃除は呼び出し側の文脈別)
function tickSuspendedResume(bot, r) {
  const m = r && r.mission; if (!m || m.status !== "suspended" || (m.suspendReason !== "cannot_recover" && m.suspendReason !== "inv_unreadable")) return null;
  if (!m.suspendWaitSince || !Number.isFinite(m.suspendWaitSince) || m.suspendWaitSince <= 0 || m.suspendWaitSince > Date.now()) { m.suspendWaitSince = Date.now(); persistMission(bot, r, true); } // cycle1807: 初回設定の瞬間に強制保存する (waiting 経路は保存を呼ばないため) / cycle2311: 未来値・文字列等の異常値は現在時刻へ打ち直す (無検証採用だと期限切れに到達しない)
  if (m.suspendReason === "inv_unreadable") {
    if (invOf(bot)) { m.blocked = null; m.invUnreadObs = 0; m.status = "active"; m.suspendReason = null; m.suspendWaitSince = null; persistMission(bot, r, true); return "resumed"; }
    if (Date.now() - m.suspendWaitSince > SUSPEND_RESUME_WAIT_MS) return "expired";
    return "waiting";
  }
  const h = hpOfMeasured(bot);
  if (h && (h.cur / h.max) >= 0.5) { m.blocked = null; m.recoverObs = 0; m.status = "active"; m.suspendReason = null; m.suspendWaitSince = null; persistMission(bot, r, true); return "resumed"; }
  if (Date.now() - m.suspendWaitSince > SUSPEND_RESUME_WAIT_MS) return "expired";
  return "waiting";
}
// cycle0606 PLAIN-SUSPEND-NOEXIT 是正: 単発 (longtask 無し・legsOnly でない) mission が通常理由で
// suspended になった場合の期限型の出口。tickSuspendedResume のスコープは広げない別担い手。
// 戻り値: null=対象外 / "waiting"=期限内 (初回は suspendWaitSince を打刻し強制保存) / "expired"=期限超過 (終了掃除は呼び出し側)
// 再開はしない (停滞カウンタ掃除なしの再開は即再suspendループになるため、終了のみが出口)。
function tickPlainSuspendExpiry(bot, r) {
  const m = r && r.mission; if (!m || m.status !== "suspended" || !PLAIN_SUSPEND_REASONS.has(m.suspendReason)) return null;
  if (m.order && m.order.legsOnly) return null; // legsOnly (建築材料集め) は gather 側の担い手がいるため対象外
  if (!m.suspendWaitSince || !Number.isFinite(m.suspendWaitSince) || m.suspendWaitSince <= 0 || m.suspendWaitSince > Date.now()) { m.suspendWaitSince = Date.now(); persistMission(bot, r, true); }
  if (Date.now() - m.suspendWaitSince > PLAIN_SUSPEND_WAIT_MS) return "expired";
  return "waiting";
}
function f1ProgressSnap(bot, r) {
  const m = r?.mission, st = (m && Array.isArray(m.steps)) ? (m.steps[m.currentStep] || null) : null;
  return { leg: r?.longtask?.legIdx ?? -1, step: m?.currentStep ?? -1, have: st?.have || 0, banked: st?.banked || 0, tSteps: r?.tunnel?.steps || 0, sK: (r?.spiral && Number.isFinite(r.spiral.k)) ? r.spiral.k : -1, y: Math.floor(bot?.location?.y ?? 0) };
}
function f1Progressed(prev, cur) { return cur.leg !== prev.leg || cur.step !== prev.step || cur.have > prev.have || cur.banked > prev.banked || cur.tSteps > prev.tSteps || cur.sK > prev.sK || cur.y < prev.y; }
function f1ResumeDecision(bot, r) {
  const m = r.mission, cur = f1ProgressSnap(bot, r), prev = r.f1ProgSnap || null;
  if (!prev) { r.f1ProgSnap = cur; r.f1NoProgResumes = 0; return (m.suspendCount || 0) >= F1_SUSPEND_TOTAL_BACKSTOP ? "terminate" : "resume"; }
  if (f1Progressed(prev, cur)) { r.f1NoProgResumes = 0; m.suspendCount = 0; } else r.f1NoProgResumes = (r.f1NoProgResumes || 0) + 1;
  r.f1ProgSnap = { ...cur, y: Math.min(prev.y, cur.y), tSteps: Math.max(prev.tSteps, cur.tSteps), sK: Math.max(prev.sK, cur.sK) };
  return r.f1NoProgResumes >= F1_NO_PROGRESS_RESUME_LIMIT ? "terminate" : "resume";
}
function groundY(dim, x, z, fallback, refY) {
  // BASICS-01: 現在Y近傍の床探索 (窓は fly.js groundNear と同じ +3/-8)。最上部ブロック
  // (天井・地表・樹冠) へは吸着しない。床候補は「立ち位置 fy が refY+1 以下で、頭上2セルに
  // 固体が無い」ものだけを適格とし、その中で参照Yに最も近いものを選ぶ。窓内に適格な床が
  // 無ければ fallback (現在Y維持 = UNKNOWN として高度を変えない)。溶岩面より下は床にしない。
  const ry = (typeof refY === "number" && isFinite(refY)) ? refY : fallback;
  if (typeof ry !== "number" || !isFinite(ry)) return fallback;
  const bx = Math.floor(x), bz = Math.floor(z);
  const cellAt = (y) => { try { return dim.getBlock({ x: bx, y, z: bz }) || null; } catch { return null; } };
  const solidAt = (y) => { const b = cellAt(y); if (!b) return null; try { return solidOfTypeId(b.typeId); } catch { return null; } };
  let best = null;
  const top = Math.floor(ry) + 3, bot = Math.floor(ry) - 8;
  for (let y = top; y >= bot; y--) {
    const b = cellAt(y); if (!b) continue;
    const id = b.typeId || "";
    if (id === "minecraft:air") continue;
    if (id.includes("lava")) break;
    if (id.includes("water")) { const fy = y + 1; if (fy <= ry + 1 && (best === null || Math.abs(fy - ry) < Math.abs(best - ry))) best = fy; break; }
    let solid = false; try { solid = solidOfTypeId(b.typeId); } catch { solid = false; }
    if (!solid) continue;
    const fy = y + 1;
    if (fy > ry + 1) continue;
    if (solidAt(y + 1) !== false || solidAt(y + 2) !== false) continue;
    if (best === null || Math.abs(fy - ry) < Math.abs(best - ry) || (Math.abs(fy - ry) === Math.abs(best - ry) && fy < best)) best = fy;
  }
  return best === null ? fallback : best;
}

function rt(bot) {
  if (!bots.has(bot.id)) bots.set(bot.id, { target: null, anchor: null, sayCd: 0, zapCd: 0, lastSay: "", lastPos: null, stuckSec: 0, scan: null, sessionStart: Date.now(), lastTopic: null, lastTopicAt: 0, moveAct: "follow", deliverFail: false, greetedDay: -1, wmem: null, perc: null, percAt: 0, percTargets: {}, work: null, goal: null, goalAt: 0, wander: null, wanderAt: 0, lastChunkKey: "",
    // v0.3.0 統合分
    nav: null, navDim: null, navMode: "direct", mission: undefined, missionKills: 0, deliveredFlag: false, conv: null, fallbackStreak: 0, lastCtx: null, lastChatAt: 0, lastPraiseAt: 0, lastDangerAt: 0, sideState: { cooldowns: {}, now: 0 }, sideTask: null, sideChase: null, sideHeldTask: null, sideContinuation: false, mTargetLoc: null, mTargetType: null, mTargetEntity: null, mTargetKind: null, mFound: false, mAtReturn: false, mScan: null, percOpps: [], buildPlan: null, hyst: null, suspendNotified: false, usedHonesty: [],
    lastAmbientAt: 0, equipCore: null, equipRestored: false, equipChanged: null, equipChangedAt: 0, equipFromOwner: false, justHealedAt: 0, lastAmmoCount: 0, lastHealCount: 0,
    // v0.3.9: 飛行・目標固定・ウォッチドッグ
    fly: null, flyDim: null, flyMode: "ground", ownerPosCache: null, moveTracker: null, moveDim: null, moveState: null, moveEvents: [], surfacebreathState: null, workglanceState: null, workglanceSeenAt: 0, chestglanceState: null, lastChestGlance: null, // POLISH-ANIM-CHESTGLANCE-01 (cyc2363): 記録のみ先行 (状態は遅延生成 createChestGlanceState) catchsightState: null, catchsightPrevItemIds: null, catchsightPending: [], lastCatchSight: null, toolcheckState: null, loadpostureState: null, partnercheckState: null, ownerreturnState: null, idleState: null, lastIdle: null, idleSinceMs: null, idleAnchor: null, toolcheckSample: null, mTargetKey: "", mTargetSince: 0, mLastHave: -1, mBanKey: "", mBanUntil: 0, takeBan: null, watchHist: [], watchAt: 0, lastHopAt: 0,
    // v0.4.0: 長期自律タスク
    longtask: undefined, ltLegActive: false, mineLeg: null, mineDir: null, spiral: null, d2Anchor: null, // 0-D2 G2: 螺旋入口は tunnel と分離して保持 (破棄は abandonTunnel/resetPlaceState 等)
    // v0.4.1: 失敗記録・装備破損の監視
    failLog: [], lastFail: null, failCount: 0, equipPrev: null, equipPollAt: 0, weaponBrokeUntil: 0, armorBrokeUntil: 0, depFailSaidAt: 0,
    // Phase 0 負荷対策: persistMission の dirty 判定と scanBlockNear の型別キャッシュ
    missionSig: null, mScanMap: null, logScanCursor: 0 });
  const r = bots.get(bot.id);
  if (!r.trace) { try { r.trace = createTrace({ load: () => dp(bot, "cb_trace", ""), save: (v) => dps(bot, "cb_trace", v) }); } catch { r.trace = null; } } // Phase4 cb_trace (v0.4.56): fail/result の記録専用。保存失敗由来の fail は器側で落とす (再帰防止)
  if (!r.workBan) { try { r.workBan = createWorkBanState(); } catch { r.workBan = null; } } // cyc2232 A02 (0-D1): workBan を初期生成し vein 選定の fail-closed 全滅を防ぐ
  if (!r.planRunner) { try { r.planRunner = createPlanRunner({ ...createSystemScheduler(system), maxSlices: 240 }); } catch { r.planRunner = null; } } // Phase4 P4-A S2-2: プローブ不可なら null のまま同期運用 (記録は fail 系の間引き作法に従い毎tick出さない)
  if (!r.failAgg) { try { r.failAgg = createFailAgg(); const rep = restoreFailAggShardsWithReport((k) => dp(bot, k, "")); if (rep && rep.status === "ok") r.failAgg = rep.agg; try { const m = JSON.parse(dp(bot, "cb_failagg", "") || "null"); if (m && Number.isInteger(m.gen)) r.failAggGen = m.gen; } catch {} r.failAggSnap = failAggSnapshot(r); } catch { if (!r.failAgg) r.failAgg = null; } } // Phase4 failAgg: S3b 永続化 (cb_failagg キー分割)。clearPlanRecords へ登録しない
  if (!r.expStore) { try { const rep = restoreExpStore((k) => dp(bot, k, "")); r.expStore = rep.store; try { const m = JSON.parse(dp(bot, "cb_exp", "") || "null"); if (m && Number.isInteger(m.gen)) r.expGen = m.gen; } catch {} r.expSnap = expSnapshot(r); } catch { if (!r.expStore) r.expStore = null; } } // 6-ML (cycle0710): 経験ストア復元。失敗時は null で本体に影響させない
  if (r.mission === undefined) { // DP cb_mission から復元（再召喚・再起動をまたぐ）
    try { const mj = dp(bot, "cb_mission", ""); r.mission = mj ? JSON.parse(mj) : null; } catch { r.mission = null; }
    // cycle1923 (a08 案B): STEP_TYPES 外のステップを含む mission は fail-closed で破棄する (版跨ぎの旧保存が無出口 mission を抱え続けないため)
    try { if (r.mission && Array.isArray(r.mission.steps) && r.mission.steps.some((st) => !STEP_TYPES.includes(st?.type))) r.mission = null; } catch {}
    r.missionSig = missionSig(r.mission); // 復元しただけの状態では DP へ書き戻さない
  }
  if (r.sessionForbids === undefined) { // Phase5 (cycle1923): セッション禁止を DP cb_forbids から復元 (undefined センチネル方式、mission と同形)
    try { const fj = dp(bot, "cb_forbids", ""); r.sessionForbids = restoreForbids(fj); } catch { r.sessionForbids = []; }
  }
  if (r.allowOnly === undefined) { // 0-C2 (cycle1604): allowOnly を DP cb_allowonly から復元 (永続化と解除は同サイクルで導入。壊れた保存は制限なし)
    try { r.allowOnly = restoreAllowOnly(dp(bot, "cb_allowonly", "")); } catch { r.allowOnly = null; }
  }
  if (r.caps === undefined) { // 0-C2 (cyc2020): セッション上限を DP cb_caps から復元 (従来は保存自体が無く、再召喚・再起動で上限だけ無言消失していた。壊れた保存は上限なし)
    try { r.caps = restoreCaps(dp(bot, "cb_caps", "")); } catch { r.caps = []; }
  }
  if (r.warehouse === undefined) { // 倉庫 W1: 台帳を DP cb_warehouse から復元 (壊れた保存は空台帳として開始し、本体を止めない)
    try { const wj = dp(bot, "cb_warehouse", ""); r.warehouse = wj ? deserializeWarehouseRegistry(wj) : createWarehouseRegistry(); } catch { r.warehouse = createWarehouseRegistry(); }
  }
  if (r.endgoal === undefined) { // ENDGOAL W-A (cyc2363): 段階1 shadow 状態を DP cb_endgoal から復元 (undefined センチネル方式。壊れた保存は未開始 null)
    try { const ej = dp(bot, "cb_endgoal", ""); const eo = ej ? JSON.parse(ej) : null;
      r.endgoal = (eo && eo.st && typeof eo.st.phase === "string") ? { st: { ...createEndgoalState(), ...eo.st }, milestones: Array.isArray(eo.milestones) ? eo.milestones.filter((x) => typeof x === "string") : [], phaseSince: eo.phaseSince || 0, endReason: eo.endReason || null, lastAction: null } : null;
    } catch { r.endgoal = null; }
    r.endgoalSig = undefined;
  }
  if (r.chestglanceState === null) { try { r.chestglanceState = createChestGlanceState(); } catch { r.chestglanceState = null; } } // POLISH-ANIM-CHESTGLANCE-01 (cyc2363): 記録のみ先行・遅延生成
  if (r.pendingConditionOrder === undefined) { // E-01 (cycle1722): 条件保留を DP cb_pending_condition から復元 (undefined センチネル方式、mission と同形。壊れた保存は保留なし)
    try { r.pendingConditionOrder = deserializePendingCondition(dp(bot, "cb_pending_condition", "")); } catch { r.pendingConditionOrder = null; }
  }
  if (r.pendingGearSet === undefined) { // 0-F R-2 (cyc2379): 一式の残り部位を DP cb_pending_gear から復元 (undefined センチネル方式)。mission が無い/復元で破棄された場合は復元せず DP 残骸も掃除する (単独では発火させない)。GEARSET-CHAIN-LTDEAD-01 (cyc2400): 部位の実行形は長期タスクが通常経路のため、存続条件に DP cb_longtask の存在も加える (復元順が longtask 復元より前段にあるため DP を直接見る)
    try { const gj = dp(bot, "cb_pending_gear", ""); const arr = gj ? JSON.parse(gj) : null; const okArr = Array.isArray(arr) ? arr.filter((x) => typeof x === "string" && x.startsWith("minecraft:")) : []; let hasLt = false; try { const lj2 = dp(bot, "cb_longtask", ""); const lo2 = lj2 ? JSON.parse(lj2) : null; hasLt = !!(lo2 && typeof lo2 === "object"); } catch {} r.pendingGearSet = ((r.mission || hasLt) && okArr.length) ? okArr : null; if (!r.pendingGearSet) dps(bot, "cb_pending_gear", ""); } catch { r.pendingGearSet = null; }
  }
  if (r.pendingAfterTool === undefined) { // RG U3 (cyc2394): 道具調達の保留注文を DP cb_pending_tool から復元 (undefined センチネル方式)。保存対象は注文オブジェクトのため kind/target/tool の形検証を行い、壊れた保存は保留なし＋DP残骸掃除。mission が無い場合は復元せず単独では発火させない
    try { const tj = dp(bot, "cb_pending_tool", ""); const mo2 = tj ? JSON.parse(tj) : null; const okMo = !!(mo2 && typeof mo2 === "object" && typeof mo2.kind === "string" && mo2.kind && typeof mo2.target === "string" && mo2.target && typeof mo2.tool === "string" && mo2.tool); r.pendingAfterTool = (r.mission && okMo) ? mo2 : null; if (!r.pendingAfterTool) dps(bot, "cb_pending_tool", ""); } catch { r.pendingAfterTool = null; }
  }
  if (r.longtask === undefined) { // DP cb_longtask から復元
    try { const lj = dp(bot, "cb_longtask", ""); r.longtask = lj ? JSON.parse(lj) : null; } catch { r.longtask = null; }
  }
  return r;
}
function stats(bot) { try { return JSON.parse(dp(bot, "cb_stats", "{}")); } catch { return {}; } }
function saveStats(bot, s) { dps(bot, "cb_stats", JSON.stringify(s)); }
function say(owner, bot, text, force = false) {
  const r = rt(bot); const now = Date.now();
  if (!force && now - r.sayCd < 7000) return;
  if (text === r.lastSay && now - r.sayCd < 30000) return;
  r.sayCd = now; r.lastSay = text;
  try { owner.sendMessage(`§b<リゼ>§r ${text}`); } catch {}
}
// 独り言（環境発話）の間引き: 大きなイベント以外は30分に1回まで（TANAKA指示 2026-11-24）
function sayAmbient(owner, bot, text) {
  const r = rt(bot); const now = Date.now();
  if (now - (r.lastAmbientAt || 0) < 30 * 60 * 1000) return;
  r.lastAmbientAt = now; say(owner, bot, text);
}
function sayFromCategoryAmbient(owner, bot, cat) {
  const lines = ALL_LINES[cat]; if (!lines || !lines.length) return;
  sayAmbient(owner, bot, pick(lines));
}
function sayFromCategory(owner, bot, cat, force = false) {
  const lines = ALL_LINES[cat]; if (!lines || !lines.length) return;
  say(owner, bot, pick(lines), force);
}

// ---------- 装備中核（equipment.js + equip_api.js） ----------
// 装備の消失監視（5秒ごと）: 前回あった装備が、付け替え操作なしに消えていたら破損/喪失として本人に認識させる
const EQUIP_SLOTS = ["Mainhand", "Head", "Chest", "Legs", "Feet"];
function pollEquipBreakage(bot, r) {
  const now = Date.now();
  if (now - (r.equipPollAt || 0) < 5000) return;
  r.equipPollAt = now;
  let cur = null;
  try {
    const c = bot.getComponent("minecraft:equippable"); if (!c) return;
    cur = {};
    for (const s of EQUIP_SLOTS) { const it = c.getEquipment(EquipmentSlot[s]); cur[s] = it ? it.typeId : null; }
  } catch (err) { noteFail(bot, "equipPoll", err); return; }
  const prev = r.equipPrev;
  r.equipPrev = cur;
  if (!prev) return;
  if (r.equipChangedAt && now - r.equipChangedAt < 8000) return; // 付け替え直後は判定しない
  if (prev.Mainhand && !cur.Mainhand) { r.weaponBrokeUntil = now + 120000; noteFail(bot, "equip:weapon_lost", new Error(prev.Mainhand)); }
  for (const s of ["Head", "Chest", "Legs", "Feet"]) if (prev[s] && !cur[s]) { r.armorBrokeUntil = now + 120000; noteFail(bot, "equip:armor_lost", new Error(prev[s])); }
}
function equipCoreOf(bot, r) {
  if (r.equipCore) return r.equipCore;
  try {
    r.equipCore = createEquipCore(bot, {
      invOf, hpOf, dp, dps,
      onEquipEvent: (kind, fromOwner) => { r.equipChanged = kind; r.equipChangedAt = Date.now(); r.equipFromOwner = !!fromOwner; },
      onEquipResult: (res) => recordEquipExp(r, res, "equip_core"), // 6-ML U4: setEquip 成否を EQUIP として記録 (記録のみ)
      onHeal: (info) => { r.justHealedAt = Date.now();
        try { const id = typeof info?.item === "string" ? info.item : "";
          const kind = /(aidkit|bandage|medical|first_aid)/.test(id) ? null
            : /(potion|milk|honey_bottle)/.test(id) ? "drink" : (id ? "food" : null);
          r.eatglanceSrc = kind ? { kind, item: id, at: Date.now(), eatMs: info?.eatMs || 1600 } : null;
        } catch {} },
    });
    if (!r.equipRestored) { r.equipRestored = true; try { r.equipCore.restore(); } catch {} }
  } catch { r.equipCore = null; }
  return r.equipCore;
}
const WEAPON_TIER_OF = (item) => !item ? "none" : item.includes("netherite") ? "netherite" : item.includes("diamond") ? "diamond" : item.includes("golden") ? "gold" : item.includes("iron") ? "iron" : item.includes("stone") ? "stone" : item.includes("wooden") ? "wood" : "none";

// ---------- 文脈構築 ----------
function supplySelfFalling(c, r, bot) {
  try {
    const vy = bot.getVelocity().y;
    const by = bot.location.y, bdim = bot.dimension.id;
    let inWater = false; try { inWater = !!bot.isInWater; } catch {}
    const hardReset = r.selfFallDim !== bdim || inWater;
    let selfFallDist;
    if (hardReset) { r.selfFallPeakY = by; r.selfFallDim = bdim; r.selfFallActive = false; selfFallDist = 0; }
    else if (vy < 0) {
      if (typeof r.selfFallPeakY !== "number" || r.selfFallActive !== true) r.selfFallPeakY = (typeof r.selfFallLastY === "number" ? r.selfFallLastY : by);
      r.selfFallActive = true; r.selfFallDim = bdim;
      selfFallDist = Math.max(0, r.selfFallPeakY - by);
    } else { r.selfFallPeakY = by; r.selfFallActive = false; r.selfFallDim = bdim; selfFallDist = 0; }
    r.selfFallLastY = by;
    c.x.selfFalling = vy < 0 && selfFallDist >= 2;
  } catch {}
}

function buildContext(bot, owner) {
  const r = rt(bot);
  const dim = bot.dimension;
  const mode = dp(bot, "cb_mode", "follow");
  const homeRaw = dp(bot, "cb_home", "");
  let home = null; try { home = homeRaw ? JSON.parse(homeRaw) : null; } catch {}
  const bHp = hpOf(bot), oHp = owner ? hpOf(owner) : { cur: 0, max: 20 };
  // 基礎 R-3 (v0.4.81, cycle0417-a03): 拠点が別次元なら距離は測れない=番兵999。
  // distHome/home.dist の両方がこの homeDist を使う (片方だけ直すと読み手が分裂する)。
  // home.registered は不変 (登録の有無は次元と独立)。dim 欠落の旧保存も不一致として 999。
  const homeSameDim = !!home && home.dim === dim.id;
  let depositBlocked = false; try { depositBlocked = !!(r.depositGuard && isDepositCooling(r.depositGuard, Date.now())) || (r.depositHomeSuppressedUntil || 0) > Date.now(); } catch {} // cycle0740 deposit P2
  // cycle0900 DEPOSIT-SUPPRESS-AND-GATE: 冷却エッジ計数を goal 選択に依存しない毎tick地点 (ここ) へ移設。
  // 旧計数 (planner case の yield 側) は選択ゲートと AND が両立せず発動0回だった (cycle0832-a13 実測)。
  try { const nowE = Date.now(); const coolingE = !!(r.depositGuard && isDepositCooling(r.depositGuard, nowE)); const suppressedE = (r.depositHomeSuppressedUntil || 0) > nowE;
    const fieldsE = { get coolSeen() { return r.depositCoolSeen; }, set coolSeen(v) { r.depositCoolSeen = v; }, get coolCycles() { return r.depositCoolCycles || 0; }, set coolCycles(v) { r.depositCoolCycles = v; }, get suppressedUntil() { return r.depositHomeSuppressedUntil || 0; }, set suppressedUntil(v) { r.depositHomeSuppressedUntil = v; } };
    const edgeE = noteDepositCoolEdge(fieldsE, coolingE, suppressedE, nowE);
    if (edgeE?.action === "suppress") { try { noteFail(bot, "planner:deposit_home_suppressed", new Error("deposit_at_home suppressed after 3 cooldown cycles")); } catch {} try { if (owner) say(owner, bot, "拠点のチェストがいっぱいのようです。しばらく入庫は止めておきます", true); } catch {} }
  } catch {}
  const homeDist = homeSameDim ? dist(bot.location, home) : 999;
  const c = {
    mode,
    self: { hpPct: bHp.max ? bHp.cur / bHp.max : 1, distOwner: owner ? dist(bot.location, owner.location) : 999, distHome: homeDist, stuck: r.stuckSec >= 3, stuckSec: r.stuckSec },
    owner: { present: !!owner, hpPct: owner ? (oHp.max ? oHp.cur / oHp.max : 1) : 0, hunger: 20, sneaking: false, sprinting: false, inWater: false, onFire: false, idleSec: 0, underground: false, dimensionSame: !!owner && owner.dimension.id === dim.id, dead: !owner },
    inv: { used: 0, size: 27, full: false, nearFull: false, hasFood: false, foodCount: 0, hasValuable: false, valuableCount: 0, hasTorch: false, hasWeapon: false },
    env: { isNight: false, isDawn: false, isDusk: false, isRaining: false, isThundering: false },
    danger: { nearestDist: 999, count: 0, creeperDist: 999, rangedDist: 999, lavaNear: false, ownerLavaNear: false, lavaBelow: false, lavaBelowDist: 999, ownerTargeted: false },
    drops: { count: 0, nearestDist: -1, valuableDist: -1, foodDist: -1, ownerDroppedDist: -1 },
    home: { registered: !!home, chestFull: false, chestMissing: false, dist: homeDist, dimensionSame: homeSameDim, depositBlocked }, // cycle0740 deposit P2
    flags: { warnOk: true, justDelivered: !!r.justDelivered, justDeposited: !!r.justDeposited, bond: dp(bot, "cb_bond", 30), trust: dp(bot, "cb_trust", 30) },
    x: {},
  };
  // インベントリ集計
  const cont = invOf(bot);
  if (cont) {
    c.inv.size = cont.size;
    for (let i = 0; i < cont.size; i++) {
      const it = cont.getItem(i); if (!it) continue;
      c.inv.used++;
      c.x.items = c.x.items || Object.create(null); c.x.items[it.typeId] = (c.x.items[it.typeId] || 0) + it.amount; // QA・ミッション観測用の所持カウント
      if (isFood(it.typeId)) { c.inv.hasFood = true; c.inv.foodCount += it.amount; }
      if (isValuable(it.typeId)) { c.inv.hasValuable = true; c.inv.valuableCount += it.amount; }
      if (it.typeId === "minecraft:torch") c.inv.hasTorch = true;
      if (it.typeId.includes("_log") || it.typeId.includes("_wood") || (it.typeId.endsWith("_stem") && /(crimson|warped)/.test(it.typeId))) c.x.woodCount = (c.x.woodCount || 0) + it.amount;
      if (it.typeId === "minecraft:cobblestone" || it.typeId === "minecraft:stone" || it.typeId === "minecraft:cobbled_deepslate") c.x.stoneCount = (c.x.stoneCount || 0) + it.amount;
      if (it.typeId === "minecraft:torch") c.x.torchCount = (c.x.torchCount || 0) + it.amount;
      if (isWeaponish(it.typeId)) c.inv.hasWeapon = true;
    }
    c.inv.full = c.inv.used >= c.inv.size;
    c.inv.nearFull = c.inv.used >= c.inv.size - 3;
  }
  // --- 窒息/埋没・クモの巣知覚 (BASICS-02): 頭部セル(目線1.62近似 +1.6)が窒息する固体=窒息、足元/中段/頭部セルが巣=拘束 ---
  // 意味論は出荷済み rules_emergency2 の現行解釈を正とする: suffocating/webStuck=主人、self*=リゼ自身。別名は将来統合の受け皿。
  // 窒息しないブロックは知識として除外する: 葉(バニラ仕様)・ガラス等の透明ブロック・氷/凍った氷・トラップドア等の非フルブロック。
  const isWebIdB02 = (id) => id === "minecraft:cobweb" || id === "minecraft:web";
  const isSuffocationExemptB02 = (id) => !id || id === "minecraft:air" || isWebIdB02(id)
    || id.endsWith("_leaves") || id === "minecraft:leaves" || id === "minecraft:leaves2"
    || id.includes("glass") || id.includes("trapdoor") || id === "minecraft:ice" || id === "minecraft:frosted_ice";
  const probeHazardB02 = (dim2, loc) => {
    const bx = Math.floor(loc.x), bz = Math.floor(loc.z);
    const ys = [...new Set([Math.floor(loc.y), Math.floor(loc.y + 1), Math.floor(loc.y + 1.6)])];
    const cells = new Map();
    for (const y of ys) cells.set(y, dim2.getBlock({ x: bx, y, z: bz }));
    let webStuck = false;
    for (const b of cells.values()) if (b && isWebIdB02(b.typeId)) { webStuck = true; break; }
    let inPowderSnow = false;
    for (const b of cells.values()) if (b && b.typeId === "minecraft:powder_snow") { inPowderSnow = true; break; }
    const head = cells.get(Math.floor(loc.y + 1.6));
    let suffocating = false;
    if (head && !isSuffocationExemptB02(head.typeId)) {
      let api = null; try { api = { isLiquid: head.isLiquid }; } catch {}
      if (!(api && api.isLiquid)) { const cell = classifyTypeId(head.typeId, api); suffocating = !!(cell.solid && !cell.water && !cell.lava); }
    }
    return { suffocating, webStuck, inPowderSnow };
  };
  try { const hz = probeHazardB02(dim, bot.location); c.x.selfSuffocating = hz.suffocating; c.x.selfWebStuck = hz.webStuck; } catch {}
  supplySelfFalling(c, r, bot);
  if (!owner) return { ctx: c, scan: null };
  try { const h = owner.getComponent("minecraft:hunger"); if (h) c.owner.hunger = h.currentValue; } catch {}
  try { c.owner.sneaking = !!owner.isSneaking; c.owner.sprinting = !!owner.isSprinting; c.owner.inWater = !!owner.isInWater; } catch {}
  // POLISH-ANIM-MIRROR-01 (cycle1421): 主人のスニーク開始の辺だけを記録する (記録のみ・表示はしない)。
  // 脳ループは実効1秒周期で判定窓900msを検証できないため、辺は suppressed として消費し windowVerified:false を明記する (cycle1421-a20 の線引き。成立したとは記録しない)
  try { const snk = !!c.owner.sneaking; if (r._mirrorPrevSneak === false && snk) { if (!r.mirrorState) r.mirrorState = createMirrorState(); const mres = recordMirrorEdge(r.mirrorState, "sneak", Date.now(), { isOwner: true, suppressed: true }); r.lastMirror = { edge: "sneak", at: Date.now(), fired: !!mres?.fired, windowVerified: false, recordOnly: true }; } r._mirrorPrevSneak = snk; } catch {}
  const ort = ownerRt.get(owner.id) || {};
  c.owner.idleSec = ort.lastMoveAt ? (Date.now() - ort.lastMoveAt) / 1000 : 0;
  const tod = world.getTimeOfDay();
  c.env.isNight = tod >= 13000 && tod <= 23000; c.env.isDawn = tod >= 23000 || tod < 1000; c.env.isDusk = tod >= 11000 && tod < 13000;
  try { const w = dim.getWeather?.(); c.env.isRaining = w === "Rain" || w === "Thunder"; c.env.isThundering = w === "Thunder"; } catch {}
  // 走査: 敵・ドロップ・他プレイヤー
  const radius = mode === "work" ? 20 : mode === "stay" ? 10 : 14;
  // v0.4.66: 見える範囲を拡大。指示・長期タスク中はドロップ品も遠くまで拾いに行く。
  // 敵の危険判定 (danger) は従来の距離のまま (遠くの敵に反応して逃げる・止まるのを防ぐ)。
  const busy = !!((r.mission && r.mission.status === "active") || r.longtask);
  const ENTITY_SCAN_R = 32, itemR = busy ? 32 : radius, dangerR = Math.max(radius, 16);
  const scan = { hostiles: [], items: [], animals: [], opportunities: [], nearestItem: null, valuableItem: null, foodItem: null, ownerItem: null, nearestHostile: null };
  const flinchCand = []; // POLISH-ANIM-FLINCH-01 (cycle1051): 予兆エンティティ候補 (落雷/点火TNT)
  let xpOrbCand = null; // POLISH-ANIM-XPGLANCE-01 (cycle0628): 既存エンティティ走査で最寄り経験値オーブを拾うだけ (新規走査なし)
  let villagerCand = null; // POLISH-ANIM-VILLAGERGREET-01 (cycle0855): 既存走査で最寄り村人 (ゾンビ村人は除く) を保持するだけ (新規走査なし)
  const curItemIds = new Set(); // POLISH-ANIM-CATCHSIGHT-01 (cycle2200): アイテム出現の辺検出用 (既存走査の id 集合)
  let deathLoc = null; try { deathLoc = JSON.parse(wdp(`cb_death:${owner.id}`, "null")); } catch {}
  let scanOk = true; // 走査が最後まで回ったか（false＝「何もいない」ではなく「分からない」）
  try {
    for (const e of dim.getEntities({ location: bot.location, maxDistance: ENTITY_SCAN_R })) {
      if (e.id === bot.id) continue;
      const d = dist(bot.location, e.location);
      if (e.typeId === "minecraft:item") {
        if (d > itemR) continue;
        let stack = null; try { stack = e.getComponent("minecraft:item")?.itemStack; } catch {}
        if (!stack) continue;
        curItemIds.add(e.id);
        if (r.takeBan && isTakeBanned(r.takeBan, e.id, stack.typeId, Date.now())) continue; // TR2136-01 (cycle2200): 見切り中の対象は走査・ポインタ・距離の全てから外す (選択側の単一の正)
        scan.items.push(e); c.drops.count++;
        scan.opportunities.push({ kind: "item", typeId: stack.typeId, pos: { x: e.location.x, y: e.location.y, z: e.location.z }, amount: stack.amount, id: e.id });
        if (c.drops.nearestDist < 0 || d < c.drops.nearestDist) { c.drops.nearestDist = d; scan.nearestItem = e; }
        if (isValuable(stack.typeId) && (c.drops.valuableDist < 0 || d < c.drops.valuableDist)) { c.drops.valuableDist = d; scan.valuableItem = e; }
        if (isFood(stack.typeId) && (c.drops.foodDist < 0 || d < c.drops.foodDist)) { c.drops.foodDist = d; scan.foodItem = e; }
        if (deathLoc && deathLoc.dim === dim.id && Date.now() - deathLoc.t < 300000 && dist(e.location, deathLoc) <= 12) {
          if (c.drops.ownerDroppedDist < 0 || d < c.drops.ownerDroppedDist) { c.drops.ownerDroppedDist = d; scan.ownerItem = e; }
        }
        continue;
      }
      if (e.typeId === "minecraft:player") { if (d > dangerR || bodies.isBody(e)) continue; if (e.id !== owner.id) { c.x.othersNear = (c.x.othersNear || 0) + 1; c.x.otherDist = Math.min(c.x.otherDist ?? 999, d); } continue; }
      if (e.typeId === "minecraft:lightning_bolt" || e.typeId === "minecraft:tnt") { flinchCand.push({ id: e.id, typeId: e.typeId, horizDist: Math.hypot(e.location.x - bot.location.x, e.location.z - bot.location.z) }); }
      if (e.typeId === "minecraft:xp_orb") { if (!xpOrbCand || d < xpOrbCand.d) xpOrbCand = { id: e.id, d, loc: { x: e.location.x, y: e.location.y, z: e.location.z } }; }
      if (e.typeId.includes("villager")) { if (d > dangerR) continue; c.x.nearVillage = true; c.x.villagerDist = Math.min(c.x.villagerDist ?? 999, d); if (!e.typeId.includes("zombie") && (!villagerCand || d < villagerCand.d)) villagerCand = { id: e.id, d, loc: { x: e.location.x, y: e.location.y, z: e.location.z } }; continue; }
      if (["minecraft:sheep", "minecraft:cow", "minecraft:pig", "minecraft:chicken"].includes(e.typeId)) { scan.animals.push(e); scan.opportunities.push({ kind: "entity", typeId: e.typeId, pos: { x: e.location.x, y: e.location.y, z: e.location.z }, id: e.id }); continue; }
      const isHostile = GVC_HOSTILE_SET.has(e.typeId) || (() => { try { return e.getComponent("minecraft:type_family")?.hasTypeFamily("monster"); } catch { return false; } })();
      if (isHostile) {
        if (d > dangerR) continue; // v0.4.66: 危険判定は従来距離
        scan.hostiles.push(e); c.danger.count++;
        if (d < c.danger.nearestDist) { c.danger.nearestDist = d; scan.nearestHostile = e; }
        if (e.typeId === "minecraft:creeper") c.danger.creeperDist = Math.min(c.danger.creeperDist, d);
        if (RANGED_IDS.has(e.typeId)) c.danger.rangedDist = Math.min(c.danger.rangedDist, d);
        const hh = hpOf(e); if (BOSS_IDS.has(e.typeId) || hh.max >= 300) { c.x.bossNear = true; c.x.bossHpPct = hh.max ? hh.cur / hh.max : 1; c.x.bossKind = e.typeId === "minecraft:warden" ? "warden" : e.typeId === "minecraft:wither" ? "wither" : e.typeId === "minecraft:ender_dragon" ? "dragon" : e.typeId === "minecraft:elder_guardian" ? "elder_guardian" : "large"; if (e.typeId.includes("gv") || e.typeId.startsWith("gun:")) c.x.gvcBoss = true; }
      }
      // HUNT-SCAN-BUCKET-01 (cyc2385): 非敵対の entity 供給源 (ウサギ/鱈/鮭/イカ/馬/ムーシュルーム等) の受け皿。
      // 家畜4種は上の分岐で処理済み。供給源集合に無い実体は保持しない (走査コストと機会提示の膨張防止)。
      if (!isHostile && entitySourceIdSet().has(e.typeId)) { scan.animals.push(e); scan.opportunities.push({ kind: "entity", typeId: e.typeId, pos: { x: e.location.x, y: e.location.y, z: e.location.z }, id: e.id }); continue; }
    }
  } catch (err) { scanOk = false; noteFail(bot, "entityScan", err); }
  // POLISH-ANIM-CATCHSIGHT-01 (cycle2200): 既存走査の id 差分でアイテム出現の辺を作る (表示層のみ・実機確認待ち)。
  // 初回走査は初期化のみ、scanOk=false の回は前回集合を前進させない (既存アイテム全件の出現誤認を防ぐ)。
  try {
    if (scanOk && owner) {
      const prev = r.catchsightPrevItemIds;
      if (prev) {
        for (const e of scan.items) {
          if (prev.has(e.id)) continue;
          const loc = { x: e.location.x, y: e.location.y, z: e.location.z };
          if (isOwnerTossCandidate(bot, owner, r, loc)) (r.catchsightPending ||= []).push({ id: e.id, loc, at: Date.now() });
        }
        if (Array.isArray(r.catchsightPending) && r.catchsightPending.length > 16) r.catchsightPending.splice(0, r.catchsightPending.length - 16);
      }
      r.catchsightPrevItemIds = curItemIds;
    }
  } catch {}
  try { if (!r.xpglanceState) r.xpglanceState = createXpGlanceState(); const resX = noteXpGlance(r.xpglanceState, { orbId: xpOrbCand ? xpOrbCand.id : "", orbPos: xpOrbCand ? xpOrbCand.loc : null, selfPos: bot.location, sameDimension: true, suppressed: (c.danger?.count ?? 0) > 0 || r.selfFalling === true }, Date.now()); if (resX === "fired") r.lastXpGlance = { at: Date.now(), orbId: xpOrbCand?.id || null }; } catch {} // POLISH-ANIM-XPGLANCE-01 (cycle0628): feeder は既存走査のオーブ候補のみ (表示層のみ・実機確認待ち)
  noteFlinch(bot, r, flinchCand); // POLISH-ANIM-FLINCH-01 (cycle1051): 出現の辺でのみ発火 (表示層のみ)
  noteSkyglance(r, c.env.isRaining, c.danger && c.danger.count > 0); // POLISH-ANIM-SKYGLANCE-01 (cycle1133)
  noteHorizonGlance(bot, r, c); // POLISH-ANIM-HORIZONGLANCE-01 (cycle0320)
  noteFullMoonGaze(bot, r, c); // POLISH-ANIM-FULLMOONGAZE-01 (v0.5.80): feeder 接続 (表示層のみ・実機確認待ち)
  noteNightwatchTick(bot, r, c); // POLISH-ANIM-NIGHTWATCH-01 (cycle0340)
  noteDryoff(r, c); // POLISH-ANIM-DRYOFF-01 (cycle1322)
  noteRainshelter(bot, dim, r, c); // POLISH-ANIM-RAINSHELTER-01 (cycle2231)
  noteLookback(r, c); // POLISH-ANIM-LOOKBACK-01 (cycle1153)
  noteThreshold(bot, dim, r, c); // POLISH-ANIM-THRESHOLD-01 (cycle1503)
  noteEdgepeek(bot, dim, r, c); // POLISH-ANIM-EDGEPEEK-01 (cycle1518)
  noteIcebalanceTick(bot, dim, r, c); // POLISH-ANIM-ICEBALANCE-01 (cycle1543)
  noteSnowtreadTick(bot, dim, r, c); // POLISH-ANIM-SNOWTREAD-01 (cycle2333)
  noteStepupTick(bot, dim, r, c); // POLISH-ANIM-STEPUP-01 (cycle1603)
  notePortalsteadyTick(bot, dim, r, c); // POLISH-ANIM-PORTALSTEADY-01 (cycle1640)
  noteSurfacebreathTick(bot, r, c); // POLISH-ANIM-SURFACEBREATH-01 (cycle1703)
  noteBubblebreathTick(bot, r, c); // POLISH-FX-BUBBLEBREATH-01 (cycle1909)
  noteToolCheckTick(bot, r, c); // POLISH-ANIM-TOOLCHECK-01 (cycle1807)
  noteWarmhandsTick(bot, r, c); // POLISH-ANIM-WARMHANDS-01 (cycle0740)
  try { r.villagerCand = villagerCand; r.villagerScanOk = scanOk; } catch {}
  noteVillagergreetTick(bot, r, c); // POLISH-ANIM-VILLAGERGREET-01 (cycle0855)
  noteOrespotTick(bot, r, c); // POLISH-ANIM-ORESPOT-01 (cycle0832)
  noteHomesightTick(bot, r, c); // POLISH-ANIM-HOMESIGHT-01 (cycle0900)
  noteIdleTick(bot, r, c); // POLISH-ANIM-IDLE-01 (cycle2020)
  noteWakestretchTick(bot, r, c); // POLISH-ANIM-WAKESTRETCH-01 (cycle0005)
  noteLoadPostureTick(bot, r, c); // POLISH-ANIM-LOADPOSTURE-01 (cycle1832)
  // 溶岩・暗さ・地下
  try {
    const bl = dim.getBlock({ x: Math.floor(bot.location.x), y: Math.floor(bot.location.y) - 1, z: Math.floor(bot.location.z) });
    c.danger.lavaNear = !!bl && bl.typeId.includes("lava");
    // cycle0721 LAVA-01/02: 検知の分離。主人向け警告は主人の足元で、落下先は下方走査で判定する (lavaNear は Bot 自身専用のまま)
    try {
      const ox = Math.floor(owner.location.x), oy = Math.floor(owner.location.y) - 1, oz = Math.floor(owner.location.z);
      const oc = [[ox, oz], [ox + 1, oz], [ox - 1, oz], [ox, oz + 1], [ox, oz - 1]].map(([x, z]) => { try { return dim.getBlock({ x, y: oy, z })?.typeId; } catch { return undefined; } });
      c.danger.ownerLavaNear = ownerLavaNearFromIds(oc);
    } catch {}
    try {
      const bx = Math.floor(bot.location.x), by = Math.floor(bot.location.y), bz = Math.floor(bot.location.z);
      const col = [];
      for (let d = 2; d < 2 + LAVA_BELOW_SCAN; d++) { try { col.push(dim.getBlock({ x: bx, y: by - d, z: bz })?.typeId); } catch { col.push(undefined); } }
      const bd = lavaBelowFromIds(col);
      c.danger.lavaBelow = bd !== null; c.danger.lavaBelowDist = bd === null ? 999 : bd;
    } catch {}
    const above = dim.getTopmostBlock({ x: Math.floor(owner.location.x), z: Math.floor(owner.location.z) });
    c.owner.underground = !!above && above.location.y > owner.location.y + 3;
  } catch {}
  // c.x 拡張
  c.x.dimension = dim.id === "minecraft:nether" ? "nether" : dim.id === "minecraft:the_end" ? "end" : "overworld";
  c.x.dragonFight = c.x.dimension === "end" && !!c.x.bossNear;
  c.x.sessionMin = (Date.now() - r.sessionStart) / 60000;
  const st = stats(bot);
  c.x.pickupTotal = st.pickup || 0; c.x.deliverTotal = st.deliver || 0; c.x.depositTotal = st.deposit || 0;
  c.x.milestone = [10, 50, 100, 250, 500, 1000].includes(c.x.pickupTotal) && r.lastMilestone !== c.x.pickupTotal;
  c.x.ownerLevel = owner.level || 0;
  // POLISH-ANIM-LEVELUPNOD-01 feeder (cyc2122): ownerLevel 設定直後の1箇所のみ。新規走査なし、表示層のみ・実機確認待ち。
  // 設定より前に置くと undefined を読み続け永遠に発火しないため、この置き順を維持すること (wiring test が固定)。
  try { if (!r.levelupnodState) r.levelupnodState = createLevelupNodState(); const dimNow = c.x.dimension; const dimChanged = r.levelupnodPrevDim != null && r.levelupnodPrevDim !== dimNow; r.levelupnodPrevDim = dimNow; const nowL = Date.now(); let overlayL = false; try { overlayL = isNodActive(r.nodAnimAt, nowL) || isFlinchActive(r.flinchAnimAt, nowL) || isSettleActive(r.settleAnimAt, nowL) || isDeliverBowActive(r.deliverBowAt, nowL); } catch {} const supL = ((c.danger?.count ?? 0) > 0) || r.selfFalling === true || !!bot.isInWater || !!r.work || !c.owner.dimensionSame; const resL = noteOwnerLevel(r.levelupnodState, { level: c.x.ownerLevel, nowMs: nowL, dimensionChanged: dimChanged, suppressed: supL, overlayActive: overlayL }); if (resL?.fired) { r.levelupnodAnimAt = nowL; r.lastLevelupNod = { atMs: nowL, fromLevel: resL.fromLevel, toLevel: resL.toLevel, delta: (resL.toLevel ?? 0) - (resL.fromLevel ?? 0) }; } } catch {}
  try { c.x.daysTogether = Math.max(0, world.getDay() - (dp(bot, "cb_firstday", world.getDay()))); } catch {}
  c.x.firstToday = r.greetedDay !== world.getDay();
  c.x.ownerBreaking = !!ort.breakAt && Date.now() - ort.breakAt < 3000;
  c.x.ownerPlacing = !!ort.placeAt && Date.now() - ort.placeAt < 3000;
  c.x.ownerY = owner.location.y; c.x.deepLevel = owner.location.y < 0;
  // --- 自己ハザード知覚 (hazard ルール帯の設計前提。取れない項目は未設定のまま＝ルールは沈黙する) ---
  try { c.x.selfInLava = !!bot.isInLava; } catch {}
  try { c.x.selfInWater = !!bot.isInWater; } catch {}
  try { c.x.selfOnFire = !!bot.isOnFire; } catch {}
  try { c.x.fireResActive = !!bot.getEffect?.("fire_resistance"); } catch {}
  try { c.x.selfPoisoned = !!bot.getEffect?.("poison"); } catch {}
  try { c.x.selfWithered = !!bot.getEffect?.("wither"); } catch {}
  // --- 主人ハザード知覚 (ENV-05): 浮遊は落下の予告。残り秒も渡し、終了間際の先回りを可能にする ---
  try { const lev = owner.getEffect?.("levitation"); c.x.ownerLevitating = !!lev; if (lev) c.x.ownerLevitationSec = Math.max(0, Math.round((lev.duration ?? 0) / 20)); } catch {}
  // --- 虚空知覚 (ENV-01): エンドで主人の足元・周囲2ブロックの柱が16ブロック下まで空なら奈落縁とみなす ---
  try {
    if (c.x.dimension === "end" && owner && c.owner.dimensionSame) {
      const ox = Math.floor(owner.location.x), oy = Math.floor(owner.location.y), oz = Math.floor(owner.location.z);
      const cols = [[ox, oz], [ox + 2, oz], [ox - 2, oz], [ox, oz + 2], [ox, oz - 2]];
      let risk = false;
      for (const [cx, cz] of cols) {
        let solid = false;
        for (let dy = 1; dy <= 16; dy++) { const b = dim.getBlock({ x: cx, y: oy - dy, z: cz }); if (b && b.typeId !== "minecraft:air") { solid = true; break; } }
        if (!solid) { risk = true; break; }
      }
      c.x.voidRisk = risk;
    }
  } catch {}
  c.x.hasMilk = !!c.x.items?.["minecraft:milk_bucket"];
  c.x.hasFireResPotion = false; // ポーション種別は所持品から判別できないため安全側 (飲用ルールは発火しない)。ENV-02 (cycle0340): この act は dormant で、足場脱出は飲用連鎖を前提にしない
  // --- ENV-02 知覚供給 (cycle0340): 材料選定は毎tick (items 集計の参照のみで安い)、岸走査は溶岩浸漬時のみ・1秒キャッシュ ---
  try {
    const eb = pickEscapeBlock(c.x.items);
    c.x.escapeBlockId = eb.id; c.x.escapeBlockCount = eb.count; c.x.hasBlocks = eb.total > 0;
    c.x.hasWaterBucket = !!c.x.items?.["minecraft:water_bucket"];
    if (c.x.selfInLava) {
      const nowE = Date.now();
      if (!r.shoreCache || nowE - r.shoreCache.at > 1000) {
        const probe = (x, y, z) => { try { const b = dim.getBlock({ x, y, z }); return b ? b.typeId : null; } catch { return null; } };
        const sc = scanShore(probe, bot.location);
        let sink = 0; try { for (let dy = 1; dy <= 3; dy++) { const b = dim.getBlock({ x: Math.floor(bot.location.x), y: Math.floor(bot.location.y) + dy, z: Math.floor(bot.location.z) }); if (b && (b.typeId === "minecraft:lava" || b.typeId === "minecraft:flowing_lava")) sink = dy; else break; } } catch {}
        r.shoreCache = { at: nowE, dist: sc.dist, dirX: sc.dirX, dirZ: sc.dirZ, need: shoreNeedFor(sc.dist, sink) };
      }
      c.x.shoreDist = r.shoreCache.dist; c.x.shoreDir = r.shoreCache.dist < 999 ? { x: r.shoreCache.dirX, z: r.shoreCache.dirZ } : null; c.x.shoreNeed = r.shoreCache.need;
    } else { c.x.shoreDist = 999; c.x.shoreDir = null; c.x.shoreNeed = 999; }
  } catch {}
  noteLavaStuck(bot, owner, r, c); // ENV-02 出口 (cycle0340): 30秒無進捗で hopeless を1回だけ申告
  try {
    const feet = dim.getBlock({ x: Math.floor(bot.location.x), y: Math.floor(bot.location.y), z: Math.floor(bot.location.z) });
    if (feet && feet.typeId === "minecraft:powder_snow") c.x.selfFreezing = true;
  } catch {}
  // --- 主人の窒息/クモの巣知覚 (BASICS-02): 必ず owner.dimension で引く(次元取り違え防止)。例外時は未設定=UNKNOWN ---
  try { const hz = probeHazardB02(owner.dimension, owner.location); c.x.suffocating = hz.suffocating; c.x.ownerSuffocating = c.x.suffocating; c.x.webStuck = hz.webStuck; c.x.ownerWebStuck = c.x.webStuck; c.x.freezing = hz.inPowderSnow; } catch {}
  // --- 主人のソウルサンド鈍足知覚 (BASICS-02-Rest Step A): 足元/支持セルが minecraft:soul_sand のときだけ true。ソウルソイルは鈍足を起こさないので含めない。例外時は未設定=UNKNOWN ---
  try { const ol = owner.location; const fy = Math.floor(ol.y); const bx2 = Math.floor(ol.x), bz2 = Math.floor(ol.z); const bFeet = owner.dimension.getBlock({ x: bx2, y: fy, z: bz2 }); const bSupport = owner.dimension.getBlock({ x: bx2, y: fy - 1, z: bz2 }); c.x.soulSandSlow = !!((bFeet && bFeet.typeId === "minecraft:soul_sand") || (bSupport && bSupport.typeId === "minecraft:soul_sand")); } catch {}
  // --- v0.2: P0/P1 知覚（監査対応） ---
  c.x.deliverFailed = !!r.deliverFail;
  c.x.selfPos = { x: bot.location.x, y: bot.location.y, z: bot.location.z };
  const dimShort = dim.id === "minecraft:nether" ? "n" : dim.id === "minecraft:the_end" ? "e" : "o";
  c.x.currentChunk = `${dimShort}:${Math.floor(bot.location.x / 16)},${Math.floor(bot.location.z / 16)}`;
  try { c.owner.onFire = !!owner.isOnFire; } catch {}
  try { c.x.ownerInBed = !!owner.isSleeping; } catch {}
  noteSleepwatchTick(bot, r, c); // POLISH-ANIM-SLEEPWATCH-01 (cycle0910): ownerInBed はこの行で初めて立つため、feeder は知覚tick列 (上記) でなく必ずここ (設定直後) で呼ぶ。前に置くと毎回 undefined で永遠に発火しない (cycle0910-a04 実測)
  noteWakegreetTick(bot, r, c); // POLISH-ANIM-WAKEGREET-01 (cyc1939): 起床の辺も ownerInBed 設定直後でしか正しく観測できないため同位置で呼ぶ
  try { const oc0 = invOf(owner); if (oc0) c.x.ownerInvFull = oc0.emptySlotsCount === 0; } catch {}
  if (scan && scan.nearestHostile) { try { c.danger.ownerTargeted = dist(scan.nearestHostile.location, owner.location) < dist(scan.nearestHostile.location, bot.location); } catch {} }
  // バイオーム正規化（getBiome の長いID → ルール語彙）
  try {
    const bt = dim.getBiome(bot.location); const bid = (bt?.id || bt?.name || "").toLowerCase(); r.biomeInferred = false;
    c.x.biome = bid.includes("desert") ? "desert" : /snow|ice|frozen/.test(bid) ? "snow" : bid.includes("jungle") ? "jungle" : /ocean|sea|beach|river/.test(bid) ? "ocean" : /cave|dripstone|lush|deep_dark/.test(bid) ? "cave" : /mountain|peak|meadow|grove|slopes/.test(bid) ? "mountain" : bid.includes("swamp") ? "swamp" : bid.includes("savanna") ? "savanna" : bid.includes("taiga") ? "taiga" : bid.includes("forest") ? "forest" : bid.includes("mushroom") ? "mushroom" : "plains";
  } catch { c.x.biome = c.owner.underground ? "cave" : "plains"; r.biomeInferred = true; }
  // 世界記憶
  const wm = wmemOf(bot);
  if (wm) {
    if (r.lastChunkKey !== c.x.currentChunk) { r.lastChunkKey = c.x.currentChunk; try { wm.recordVisit(bot.location, dim.id); } catch {} }
    try { c.x.knownDanger = wm.dangerNear(bot.location, dim.id, 8).length > 0; c.x.familiarHere = wm.familiarityAt(bot.location, dim.id) || 0; } catch {}
    try { const nc = wm.nearestContainer(bot.location, dim.id, { excludeFull: true }); if (nc) c.x.knownChestDist = dist(bot.location, nc); } catch {}
  }
  // 知覚ライト: 半径3・5高さのブロック走査（4秒に1回、結果はキャッシュ）
  if (Date.now() - r.percAt > 4000 || !r.perc) {
    r.percAt = Date.now(); r.percTargets = {};
    const pcOpps = [];
    const pc = { tree: -1, ore: -1, crop: -1, cropYoung: -1, stone: -1, oreValuable: false, nearCraft: false, nearFurnace: false, nearHeat: false, nearMachine: false, nearBed: false, darkness: false, shrieker: false, failedCells: 0, totalCells: 245 };
    const selD = { tree: -1, ore: -1, stone: -1, crop: -1 }; // forbids G6-c (cycle0628): 候補選出専用の距離 (統計 pc.* と分ける。禁止候補が距離だけ更新して非禁止候補を塞ぐ事故を防ぐ)
    const forbT = (tid) => { try { return isForbiddenWorkTarget(r.sessionForbids, tid, dropOfWorkTarget); } catch { return false; } };
    const wbanned = (loc, tid) => { try { return isWorkBanned(r.workBan, loc, tid, Date.now()); } catch { return false; } }; // cycle0832 F5: work層 ban 中セルは選出から外す (統計 pc.* は維持し次点が載る形)
    const bx = Math.floor(bot.location.x), by = Math.floor(bot.location.y), bz = Math.floor(bot.location.z);
    for (let dx = -3; dx <= 3; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -3; dz <= 3; dz++) {
      let b = null; try { b = dim.getBlock({ x: bx + dx, y: by + dy, z: bz + dz }); } catch {}
      if (!b) { pc.failedCells++; continue; } const tid = b.typeId; const dd = Math.hypot(dx, dy, dz);
      if (tid.includes("_log") || tid.includes("_wood") || (tid.endsWith("_stem") && /(crimson|warped)/.test(tid))) { if (pc.tree < 0 || dd < pc.tree) pc.tree = dd; if (!forbT(tid) && !wbanned(b.location, tid) && (selD.tree < 0 || dd < selD.tree)) { selD.tree = dd; r.percTargets.tree = { x: b.location.x, y: b.location.y, z: b.location.z, typeId: tid }; } }
      else if (tid.includes("_ore") || tid === "minecraft:ancient_debris") { if (VALUABLE_ORES.has(tid)) pc.oreValuable = true; if (pc.ore < 0 || dd < pc.ore) pc.ore = dd; if (!forbT(tid) && !wbanned(b.location, tid) && (selD.ore < 0 || dd < selD.ore)) { selD.ore = dd; r.percTargets.ore = { x: b.location.x, y: b.location.y, z: b.location.z, typeId: tid }; } }
      else if (NATURAL_STONE.has(tid)) { if (pc.stone < 0 || dd < pc.stone) pc.stone = dd; if (!forbT(tid) && !wbanned(b.location, tid) && (selD.stone < 0 || dd < selD.stone)) { selD.stone = dd; r.percTargets.stone = { x: b.location.x, y: b.location.y, z: b.location.z, typeId: tid }; } }
      else if (Object.prototype.hasOwnProperty.call(CROP_MATURITY_MAX, tid)) {
        let g = null; try { g = b.permutation?.getState("growth") ?? b.permutation?.getState("age"); } catch {}
        if (isCropMature(tid, g)) { if (pc.crop < 0 || dd < pc.crop) pc.crop = dd; if (!forbT(tid) && !wbanned(b.location, tid) && (selD.crop < 0 || dd < selD.crop)) { selD.crop = dd; r.percTargets.crop = { x: b.location.x, y: b.location.y, z: b.location.z, typeId: tid }; } }
        else if (pc.cropYoung < 0 || dd < pc.cropYoung) pc.cropYoung = dd; // cycle0832 F2: 未成熟株 (growth読取不能も存在は確定としてこちらへ) を成熟と分けて数える
      }
      if (/flower/.test(tid) || tid === "minecraft:snow_layer" || tid === "minecraft:short_grass" || tid === "minecraft:tall_grass" || tid === "minecraft:fern" || tid === "minecraft:sugar_cane") pcOpps.push({ kind: "block", typeId: tid, pos: { x: b.location.x, y: b.location.y, z: b.location.z } }); // 基礎 N2 (v0.4.65): サトウキビも side 採取の機会に載せる (side_tasks の現行IDと対)
      if (tid === "minecraft:crafting_table") { pc.nearCraft = true; try { if (wm?.recordWorkstation) wm.recordWorkstation(b.location, dim.id, tid); } catch {} }
      if (tid === "minecraft:campfire" || tid === "minecraft:soul_campfire" || tid === "minecraft:lit_furnace" || tid === "minecraft:lit_blast_furnace" || tid === "minecraft:lit_smoker") pc.nearHeat = true; // cycle0740 WARMHANDS feeder: 点火中熱源のみ (分類1分岐・新規走査なし)
      if (/furnace|smoker/.test(tid)) { pc.nearFurnace = true; try { if (wm?.recordWorkstation) wm.recordWorkstation(b.location, dim.id, tid); } catch {} }
      if (tid.startsWith("orbital_foundry:")) pc.nearMachine = true;
      if (tid.endsWith(":bed") || tid.endsWith("_bed")) { pc.nearBed = true; try { if (wm?.recordBed) wm.recordBed(b.location, dim.id); } catch {} }
      if (isContainerBlock(tid)) { try { if (wm?.recordContainer) wm.recordContainer(b.location, dim.id, { kind: tid, source: "scan", confidence: 0.9 }); } catch {} }
      if (tid === "minecraft:sculk_shrieker") pc.shrieker = true;
    }
    r.perc = pc;
    r.percFresh = true;
    r.percOpps = pcOpps;
  }
  if (r.perc) {
    c.x.nearestTreeDist = r.perc.tree; c.x.nearestOreDist = r.perc.ore; c.x.cropReadyDist = r.perc.crop; c.x.nearestStoneDist = r.perc.stone; c.x.oreValuable = !!r.perc.oreValuable;
    c.x.nearCraft = r.perc.nearCraft; c.x.nearFurnace = r.perc.nearFurnace; c.x.nearHeat = !!r.perc.nearHeat; c.x.nearMachine = r.perc.nearMachine; c.x.nearCrop = r.perc.crop >= 0 || (r.perc.cropYoung ?? -1) >= 0; c.x.cropMature = r.perc.crop >= 0; c.x.cropYoungDist = r.perc.cropYoung ?? -1; // cycle0832 F2: nearCrop と cropMature の同値供給を分離 (未成熟畑ルール群の到達不能を解消) c.x.shriekerNear = !!r.perc.shrieker; c.x.nearBed = !!r.perc.nearBed;
    const dark = (c.owner.underground || c.env.isNight) && !r.perc.nearFurnace;
    c.x.lightLevel = c.owner.underground ? 5 : c.env.isNight ? 7 : 13;
    c.x.darkness = dark && c.x.lightLevel <= 7;
    // cycle2117 torchfix: 設置可能性を三状態で供給 (読めない tick は未設定=UNKNOWN のまま)
    try {
      const fx = Math.floor(bot.location.x), fy = Math.floor(bot.location.y), fz = Math.floor(bot.location.z);
      const feetB = bot.dimension.getBlock({ x: fx, y: fy, z: fz });
      const belowB = bot.dimension.getBlock({ x: fx, y: fy - 1, z: fz });
      if (feetB && belowB) c.x.torchPlaceable = feetB.typeId === "minecraft:air" && belowB.typeId !== "minecraft:air" && !belowB.isLiquid;
    } catch {}
    try { if (r.torchDone && Date.now() - r.torchDone.at < 10 * 60 * 1000 && r.torchDone.dim === bot.dimension.id) { c.x.torchDoneAt = r.torchDone.at; c.x.torchDoneCell = r.torchDone.cell; } } catch {}
  }
  try { c.x.ownerFlying = !!owner.isFlying; c.x.ownerRiding = !!owner.getComponent("minecraft:riding"); } catch {}
  noteMountglanceTick(bot, r, c); // POLISH-ANIM-MOUNTGLANCE-01 (cycle0936): ownerRiding はこの行で初めて立つため、feeder は必ずここ (設定直後) で呼ぶ。前に置くと毎回 undefined で永遠に発火しない (SLEEPWATCH と同型の教訓)
  c.x.fastMove = c.owner.sprinting || c.x.ownerFlying;
  // --- 主人の落下知覚 (BASICS-02-Rest Step B): ownerRt に空中区間の最高点 fallPeakY と次元 fallDim を保持し、落下距離を供給する。次元は owner.dimension.id (生id) で持つ (c.x.dimension はリゼ自身の変換済み値で別物)。例外時は両フィールドとも未設定=UNKNOWN で状態も進めない ---
  try {
    const vy = owner.getVelocity().y;
    const oy = owner.location.y, odim = owner.dimension.id;
    // 基礎 B-F-07 (v0.4.65): 落下区間は vy<0 の連続区間だけ。区間開始時の高さ (前tickの y) を
    // fallPeakY とし、vy>=0 になったら区間終了としてピークを現在高さへ畳む。旧規則は着地後も
    // fallPeakY > oy の間リセットされず、歩行下山でも落下距離が累積して落下系ルールが誤発火した。
    const hardReset = ort.fallDim !== odim || !!c.x.ownerLevitating || !!c.x.ownerFlying || !!c.owner.inWater;
    let fallDist;
    if (hardReset) { ort.fallPeakY = oy; ort.fallDim = odim; fallDist = 0; }
    else if (vy < 0) {
      if (typeof ort.fallPeakY !== "number" || ort.fallActive !== true) ort.fallPeakY = (typeof ort.fallLastY === "number" ? ort.fallLastY : oy);
      ort.fallActive = true; ort.fallDim = odim;
      fallDist = Math.max(0, ort.fallPeakY - oy);
    } else { ort.fallPeakY = oy; ort.fallActive = false; ort.fallDim = odim; fallDist = 0; }
    ort.fallLastY = oy;
    ownerRt.set(owner.id, ort);
    c.x.ownerFallDist = fallDist;
    c.x.falling = vy < 0 && fallDist >= 2;
    // POLISH-ANIM-OWNERFALLTRACK-01 feeder (cycle0033): reuse existing owner-fall perception, no new scan (display only)
    try {
      if (!r.ownerfalltrackState) r.ownerfalltrackState = createOwnerfalltrackState();
      const gr2 = gazeRotation(bot.location, owner.location); let cur2 = null; try { cur2 = bot.getRotation(); } catch {}
      const sample = { ownerFalling: !!c.x.falling, fallDist, relYawDeg: (gr2 && cur2) ? ((gr2.y - cur2.y + 540) % 360) - 180 : undefined, relPitchDeg: (gr2 && cur2) ? gr2.x - cur2.x : undefined, inCombat: !!((c?.danger?.count ?? 0) > 0), selfFalling: r.selfFalling === true, working: !!r.work, inWater: !!c?.owner?.inWater };
      const res2 = noteOwnerfalltrack(r.ownerfalltrackState, sample, Date.now());
      r.ownerfalltrackSample = sample;
      if (res2 && res2.fired) r.lastOwnerFallTrack = { at: Date.now(), episode: r.ownerfalltrackState.episode };
    } catch {}
  } catch {}
  // 拠点チェスト状態
  if (home && home.dim === dim.id) {
    try { const hb = dim.getBlock(home); if (!hb || !isContainerBlock(hb.typeId)) c.home.chestMissing = true; else { const hc = hb.getComponent("minecraft:inventory")?.container; if (hc) { c.home.chestFull = hc.emptySlotsCount === 0; try { const wm2 = wmemOf(bot); if (wm2?.recordContainer) wm2.recordContainer(home, dim.id, { full: c.home.chestFull, kind: hb.typeId, source: "home_measured", confidence: 1, contents: (() => { const cc = Object.create(null); try { for (let i = 0; i < hc.size; i++) { const it = hc.getItem(i); if (it) cc[it.typeId] = (cc[it.typeId] || 0) + it.amount; } } catch {} return cc; })() }); } catch {} } } } catch { c.home.chestMissing = true; }
  }
  // --- v0.3.0: QA・知識・ミッション・視線向けの文脈拡張 ---
  c.x.timeOfDay = tod;
  try { c.x.worldDay = world.getDay(); } catch {}
  c.x.homePos = home;
  c.x.percTargets = r.percTargets;
  c.x.opportunities = [...(scan ? scan.opportunities : []), ...(r.percOpps || [])];
  const mis = r.mission;
  c.x.order = mis && mis.status === "active" ? { active: true, kind: mis.order.kind, targetItem: mis.order.target, hostiles: mis.order.constraints.hostiles } : null;
  if (mis && mis.status === "active") {
    const cs = mis.steps[mis.currentStep];
    c.x.orderProgress = cs ? { have: cs.have || 0, need: cs.need || 0 } : null;
    c.x.targetSeen = !!r.mFound;
    c.x.orderElapsedMin = (Date.now() - mis.startedAt) / 60000;
  }
  try { const vd = owner.getViewDirection(); c.x.heading = { x: vd.x, z: vd.z }; } catch { c.x.heading = null; }
  if (r.target) { const dx = r.target.x - bot.location.x, dz = r.target.z - bot.location.z; const m = Math.hypot(dx, dz); if (m > 0.1) c.x.heading = { x: dx / m, z: dz / m }; }
  if (c.danger.count > 0) r.lastDangerAt = Date.now();
  c.gaze = {
    sinceChatSec: r.lastChatAt ? (Date.now() - r.lastChatAt) / 1000 : 99999,
    sincePraiseSec: r.lastPraiseAt ? (Date.now() - r.lastPraiseAt) / 1000 : 99999,
    sinceDangerSec: r.lastDangerAt ? (Date.now() - r.lastDangerAt) / 1000 : 99999,
  };
  c.x.working = !!r.work;
  c.x.workTargetKind = r.work ? (CROP_DROPS[r.work.typeId] ? "crop" : (r.work.typeId.includes("_log") || r.work.typeId.includes("_wood") || (r.work.typeId.endsWith("_stem") && /(crimson|warped)/.test(r.work.typeId))) ? "tree" : "ore") : null;
  c.x.workTargetDist = r.work ? dist(bot.location, r.work.loc) : 999;
  // 装備スナップショット（rules_equipment の要求フィールド）
  const eqCore = equipCoreOf(bot, r);
  if (eqCore) {
    try {
      const snap = eqCore.snapshot();
      c.x.hasWeapon = snap.hasWeapon; c.x.weaponItem = snap.weaponItem; c.x.weaponDamage = snap.weaponDamage;
      c.x.weaponTier = snap.hasWeapon ? WEAPON_TIER_OF(snap.weaponItem) : "none";
      c.x.hasGun = snap.hasGun; c.x.gunItem = snap.gunItem; c.x.ammoCount = snap.totalAmmoLeft;
      c.x.ammoLow = snap.hasGun && snap.totalAmmoLeft >= 1 && snap.totalAmmoLeft <= 5;
      c.x.armorPoints = snap.armorPoints;
      c.x.hasHealItem = snap.healItems > 0; c.x.healItemCount = snap.healItems;
      let off = null; try { off = eqCore.getEquipped("Offhand"); } catch {}
      c.x.hasShield = !!off && off.typeId === "minecraft:shield";
      // 在庫の増加で「受け取った」変化を検知（UI 経由の変更は onEquipEvent が先に記録する）
      if (snap.totalAmmoLeft > (r.lastAmmoCount || 0) && snap.hasGun && Date.now() - r.equipChangedAt > 6000) { r.equipChanged = "ammo"; r.equipChangedAt = Date.now(); r.equipFromOwner = false; }
      if (snap.healItems > (r.lastHealCount || 0) && Date.now() - r.equipChangedAt > 6000) { r.equipChanged = "heal"; r.equipChangedAt = Date.now(); r.equipFromOwner = false; }
      r.lastAmmoCount = snap.totalAmmoLeft; r.lastHealCount = snap.healItems;
      const dur = durabilityPcts(bot);
      if (dur.weapon !== undefined) c.x.weaponDurabilityPct = dur.weapon;
      if (dur.armor !== undefined) c.x.armorDurabilityPct = dur.armor;
      try { let mh = null; try { mh = eqCore.getEquipped("Mainhand"); } catch {} const heldId = mh?.typeId || null; if (!r.swapSoundState) r.swapSoundState = createSwapSoundState(); const sd = noteHeldItem(r.swapSoundState, { typeId: heldId, nowMs: Date.now(), suppressed: false }); r.swapSoundState = sd.state; if (sd.decision && sd.decision.fire) r.lastSwapSound = { at: Date.now(), from: sd.decision.fromTypeId, to: sd.decision.toTypeId, kind: sd.decision.reason, volume: sd.decision.volume, pitch: sd.decision.pitch }; } catch {} // POLISH-FX-SWAP-01 (cycle2311): 持ち替えの辺を記録のみ (音 ID 未照合のため実音なし・表示層のみ)
    } catch {}
  }
  c.x.equipChanged = r.equipChangedAt && Date.now() - r.equipChangedAt < 6000 ? r.equipChanged : null;
  c.x.equipFromOwner = c.x.equipChanged ? !!r.equipFromOwner : false;
  c.x.justHealed = !!r.justHealedAt && Date.now() - r.justHealedAt < 6000;
  // v0.4.1: 装備の消失監視（破損検知）と、知覚の三状態（ok / unknown）・失敗の自己認識
  pollEquipBreakage(bot, r);
  c.x.weaponBroke = Date.now() < (r.weaponBrokeUntil || 0);
  c.x.armorBroke = Date.now() < (r.armorBrokeUntil || 0);
  c.x.scanOk = scanOk;
  c.x.invOk = !!invOf(bot);
  // Phase1 Phase A: 観測メタの並行露出（追加のみ・既存フィールドと挙動は不変）。新規の読み手は 999/-1 を直接見ず obs と併せて解釈する
  const _percObs = !r.perc ? { state: "unavailable", at: 0, failedCells: 245, totalCells: 245 } : { state: r.percFresh ? "fresh" : "cached", at: r.percAt || 0, failedCells: r.perc.failedCells ?? 0, totalCells: r.perc.totalCells ?? 245 };
  r.percFresh = false;
  const _bs = r.lastBlockScan; const _blockScanObs = !_bs ? { state: "unavailable", at: 0, failedCells: 0, totalCells: 2601 } : { state: Date.now() - _bs.at < SCAN_TTL_MS + 2000 ? "fresh" : "cached", at: _bs.at, failedCells: _bs.failedCells ?? 0, totalCells: _bs.totalCells ?? 2601, typeId: _bs.typeId || null };
  c.x.obs = { scan: scanOk ? "ok" : "unknown", inv: c.x.invOk ? "ok" : "unknown", perc: _percObs, biome: r.biomeInferred ? "inferred" : "measured", light: "synthetic", danger: scanOk ? "measured" : "unknown", blockScan: _blockScanObs };
  c.x.lastFail = r.lastFail && Date.now() - r.lastFail.at < 60000 ? r.lastFail.where : null;
  c.x.failCount = r.failCount || 0;
  r.scan = scan;
  noteShiverTick(bot, r, c); // POLISH-ANIM-SHIVER-01 (cyc2355): biome/selfFreezing 設定後に呼ぶ (理由は noteShiverTick のコメント参照)
  return { ctx: c, scan };
}

// ---------- 実行部 ----------
function transferFiltered(bot, targetCont, filterFn) {
  const src = invOf(bot); if (!src || !targetCont) return { moved: 0, failed: false };
  let moved = 0, failed = false;
  for (let i = 0; i < src.size; i++) {
    const it = src.getItem(i); if (!it) continue;
    if (filterFn && !filterFn(it.typeId)) continue;
    const before = it.amount;
    const rest = targetCont.addItem(it);
    const left = rest ? rest.amount : 0;
    moved += before - left;
    if (left > 0) { src.setItem(i, rest); failed = true; } else src.setItem(i, undefined);
  }
  return { moved, failed };
}
function deliverFilterFor(rule) {
  if (!rule) return null;
  if (rule.act === "deliver_food") return isFood;
  if (rule.act === "deliver_valuable") return isValuable;
  const id = rule.id || "";
  if (/food|meal|hungry/.test(id)) return isFood;
  if (/weapon/.test(id)) return isWeaponish;
  if (/torch/.test(id)) return (t) => t === "minecraft:torch";
  if (/valuable/.test(id)) return isValuable;
  return null;
}
function homeOf(bot) { try { return JSON.parse(dp(bot, "cb_home", "")); } catch { return null; } }
/* FW-03/RR-08 (cycle1058): 帰還点の単一解決。次元一致時のみ入庫点 (+0.5,+1,+0.5) を返し、不一致・dim欠落・不正形は null。
   呼び手は既存フォールバック (主人背後等) へ倒すこと。コンテナセル中心 {...home} を目標化しない (体が入れないセル＋別次元座標の追跡を防ぐ) */
function homeEntryPoint(bot, h) { try { if (!h || h.dim !== bot.dimension.id) return null; const x = Number(h.x), y = Number(h.y), z = Number(h.z); if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null; return { x: x + 0.5, y: y + 1, z: z + 0.5 }; } catch { return null; } }
// BH-04 (cycle1215): stay アンカーの単一の出入り口。位置も cb_mode と同じ entity DP (cb_anchor) へ保存し、
// runtime 再生成 (再起動・再読込・bots.delete) 後も待機位置が移転しないようにする。消去も必ずここを通す
// (DP 化と消去同期を分離すると、消したはずのアンカーが再起動で復活する)。
function anchorOf(bot) { try { const a = JSON.parse(dp(bot, "cb_anchor", "")); if (!a || !Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(a.z)) return null; return { x: a.x, y: a.y, z: a.z, dim: a.dim || null }; } catch { return null; } }
function setAnchor(bot, r, loc, dimId) { try { if (r) r.anchor = loc ? { x: loc.x, y: loc.y, z: loc.z } : null; dps(bot, "cb_anchor", loc ? JSON.stringify({ x: loc.x, y: loc.y, z: loc.z, dim: dimId || null }) : ""); } catch {} }
function execTarget(bot, owner, rule, ctx, scan) {
  const r = rt(bot); const act = rule ? rule.act : "follow";
  const o = owner.location; const vd = (() => { try { return owner.getViewDirection(); } catch { return { x: 0, z: 1 }; } })();
  const behind = (d) => { const m = Math.hypot(vd.x, vd.z); const ux = m > 1e-4 ? vd.x / m : 0, uz = m > 1e-4 ? vd.z / m : 1; return { x: o.x - ux * d, y: o.y, z: o.z - uz * d }; }; // FW-01 (cycle0537): 視線の水平成分を正規化 (ピッチで距離が潰れないように)。真上/真下は既存フォールバック方向 {0,1}
  const home = homeOf(bot);
  switch (act) {
    case "follow_close": case "greet": case "celebrate": case "say_only": return behind(1.8);
    case "follow_high": return behind(4);
    case "go_owner": case "warn_owner_low": return behind(1.5); // FW-02 (cycle0537): 主人セルそのものは体が入れないため背後オフセットへ
    case "catchup": {
      if (ctx.self.distOwner > 20 || !ctx.owner.dimensionSame) { try { teleportNearOwnerGuarded(bot, r, owner.dimension, behind(2), owner.location); } catch {} } // queue3 step2: place ゲート共通ヘルパー経由 (無検査フォールバック廃止)
      return behind(2.5);
    }
    case "stay_anchor": { const anch = anchorOf(bot); if (anch && dp(bot, "cb_mode", "") === "stay" && (!anch.dim || anch.dim === bot.dimension.id)) return { x: anch.x, y: anch.y, z: anch.z }; return r.anchor || bot.location; } // BH-04: stay 中は DP の定位置を正とし、次元が違う場合は現在位置へ倒す。一時的な stay_anchor (取引・見張り等) は従来どおりメモリ側を使う
    case "idle_hover": return bot.location;
    case "patrol_home": {
      const c0 = homeEntryPoint(bot, home) || o; const a = (Date.now() / 4000) % (Math.PI * 2);
      return { x: c0.x + Math.cos(a) * 5, y: c0.y, z: c0.z + Math.sin(a) * 5 };
    }
    case "return_home": case "go_home": case "rest_at_home": return homeEntryPoint(bot, home) || behind(2);
    case "deposit": case "chest_alert": return homeEntryPoint(bot, home) || behind(2); // A08-01 (cycle1514, a22ハーネス実測で確定): 次元照合済みの入口を使う (従来は home 無照合で別次元の入庫点を返し続け到達不能ループになった)
    case "deliver_all": case "deliver_food": case "deliver_valuable": return behind(1.5);
    case "pickup_valuable": return scan?.valuableItem?.location || scan?.nearestItem?.location || behind(3);
    case "pickup_food": return scan?.foodItem?.location || scan?.nearestItem?.location || behind(3);
    case "pickup_owner_drops": return scan?.ownerItem?.location || behind(3);
    case "pickup_nearest": return scan?.nearestItem?.location || behind(3);
    case "guard": case "zap": return scan?.nearestHostile?.location || behind(2);
    case "flee": {
      const h = scan?.nearestHostile?.location || o; const dx = bot.location.x - h.x, dz = bot.location.z - h.z; const m = Math.hypot(dx, dz) || 1;
      return { x: bot.location.x + (dx / m) * 10, y: bot.location.y, z: bot.location.z + (dz / m) * 10 };
    }
    case "rise_avoid": { const b = behind(2); return { x: b.x, y: Math.max(bot.location.y, o.y) + 3, z: b.z }; } // LAVA-05 (cycle0423): 上昇は現在位置基準でないと主人より上にいる場合に下降になる。+3 は escape_hazard と同量
    case "escape_hazard": case "surface": return { x: bot.location.x, y: bot.location.y + 3, z: bot.location.z }; // ハザード脱出/浮上は真上へ
    case "place_block_escape": { const sd = ctx?.x?.shoreDir || (r.shoreCache && r.shoreCache.dist < 999 ? { x: r.shoreCache.dirX, z: r.shoreCache.dirZ } : null); return sd ? { x: bot.location.x + sd.x * 2, y: bot.location.y + 1, z: bot.location.z + sd.z * 2 } : { x: bot.location.x + 1, y: bot.location.y + 1, z: bot.location.z }; } // ENV-02 (cycle0340): 岸方向へ寄る
    case "seek_water": return behind(2); // 水場の実座標は未走査のため主人側へ寄りつつ消火を待つ
    case "drink_fire_res": case "drink_milk": return bot.location; // 飲用中はその場に留まる
    case "use_heal_item": return bot.location; // 回復使用中はその場に留まる
    default: return behind(3);
  }
}
function execArrive(bot, owner, rule, ctx, scan) {
  const r = rt(bot); const act = rule?.act; if (!act) return;
  const d = dist(bot.location, owner.location);
  if ((act.startsWith("pickup")) && scan) {
    const item = act === "pickup_valuable" ? (scan.valuableItem || scan.nearestItem) : act === "pickup_food" ? (scan.foodItem || scan.nearestItem) : act === "pickup_owner_drops" ? scan.ownerItem : scan.nearestItem;
    if (item && dist(bot.location, item.location) < 1.9) {
      const cont = invOf(bot); let stack = null; try { stack = item.getComponent("minecraft:item")?.itemStack; } catch {}
      if (cont && stack) {
        const rest = cont.addItem(stack);
        if (!rest) { try { item.remove(); } catch {} const st = stats(bot); st.pickup = (st.pickup || 0) + stack.amount; saveStats(bot, st); recordTake(r, "execArrive", { ok: true, taken: stack.amount, item: stack.typeId }); noteInspectPickup(bot, r, ctx, stack.typeId); /* POLISH-SND-PICKUP-01 (cycle0710) */ try { if (!r.sfxState) r.sfxState = createSfxState(); sfxPickup(r.sfxState, bot.dimension, bot.location, Date.now()); } catch {} if (Math.random() < 0.5) say(owner, bot, genSpeech({ say: { item: nameOfItem(stack.typeId), count: stack.amount }, drops: { count: ctx.drops.count }, flags: { bond: dp(bot, "cb_bond", 30) }, x: {} }, "pickup_report"));
        else sayFromCategory(owner, bot, isValuable(stack.typeId) ? "pickup_valuable" : "pickup_done"); }
        else if (rest.amount < stack.amount) { try { item.remove(); bot.dimension.spawnItem(rest, item.location); } catch {} recordTake(r, "execArrive", { ok: true, taken: stack.amount - rest.amount, partial: true, item: stack.typeId }); }
        else { recordTake(r, "execArrive", { ok: false, reason: "INVENTORY_FULL", item: stack.typeId }); noteTakeFull(bot, r, String(item.id) + ":" + stack.typeId, stack.typeId); noteTakeBan(r, item.id, stack.typeId); }
      } else { recordTake(r, "execArrive", { ok: false, reason: cont ? "ITEM_NOT_FOUND" : "TARGET_UNKNOWN", item: stack?.typeId || null }); }
    }
  }
  if ((act === "guard" || act === "zap") && scan?.nearestHostile) {
    const hd = dist(bot.location, scan.nearestHostile.location);
    const core = equipCoreOf(bot, r);
    let gunRange = 0; if (core) { try { const s = core.snapshot(); if (s.hasGun) gunRange = s.gunRange; } catch {} }
    if (hd < 3.2 || (gunRange > 0 && hd <= gunRange)) zapEntity(bot, r, scan.nearestHostile);
  }
  if (act === "use_heal_item") { const core = equipCoreOf(bot, r); if (!core) { r.lastUseItem = { act, ok: false, reason: "EQUIP_CORE_UNAVAILABLE", item: null, at: Date.now() }; commitLastAction(r, r.lastUseItem); } else { try { const res = core.useHealItem(); r.lastUseItem = { act, ok: !!res?.ok, reason: res?.reason || null, item: res?.item || null, at: Date.now() }; commitLastAction(r, r.lastUseItem); /* POLISH-SND-EAT-01 (cycle0753) */ if (res?.ok) { try { sfxEat(bot.dimension, bot.location, res?.item || null); } catch {} } } catch (e) { r.lastUseItem = { act, ok: false, reason: "API_ERROR", item: null, at: Date.now() }; commitLastAction(r, r.lastUseItem); noteFail(bot, "use_heal_item:exception", e, {expDone: true}); } } } // Phase2 USE_ITEM 無言経路 S1/S2 (v0.4.13): 記録のみ、挙動不変
  // Phase2 USE_ITEM 実体化 (milk先行): 幻影 act drink_milk を実体化。消費→有害効果(毒/衰弱)の対象除去→空バケツ返却→再読検証。
  // 対象除去に留め有益効果 (耐火等) は消さない (a03 DESIGN §2.8 裁定)。結果は r.lastUseItem へ契約形で記録し破棄しない。
  if (act === "drink_milk") {
    const now = Date.now();
    if (now < (r.useItemLockUntil || 0)) { /* 直前の飲用ロック中は再消費しない。Phase2 USE_ITEM S3 (v0.4.14): 無言経路をロック期間ごとに1回だけ記録化 (理由は既存契約語彙 EATING、挙動不変) */
      if (r.useItemLockNotedFor !== r.useItemLockUntil) { r.useItemLockNotedFor = r.useItemLockUntil; r.lastUseItem = { act, ok: false, reason: "EATING", item: "minecraft:milk_bucket", readyInMs: (r.useItemLockUntil || 0) - now, at: now }; commitLastAction(r, r.lastUseItem); }
    }
    else if (!takeFromInv(bot, "minecraft:milk_bucket", 1)) { r.lastUseItem = { act, ok: false, reason: "ITEM_NOT_FOUND", item: "minecraft:milk_bucket", at: now }; commitLastAction(r, r.lastUseItem); }
    else {
      r.useItemLockUntil = now + 3000;
      let removed = [];
      for (const eff of ["poison", "wither"]) { try { if (bot.getEffect?.(eff)) { bot.removeEffect?.(eff); removed.push(eff); } } catch {} }
      // Phase2 milk E1是正 (v0.4.11): 空バケツ返却は station と同型に、満杯時は addItem の残量を捨てず足元へ落とす (消失させない)
      let bucketReturned = false, bucketDropped = false;
      try { const bc = invOf(bot); let rest = 1; if (bc) rest = addTo(bc, "minecraft:bucket", 1); bucketReturned = rest === 0; if (rest > 0) { try { bot.dimension.spawnItem(new ItemStack("minecraft:bucket", rest), bot.location); bucketDropped = true; } catch {} } } catch {}
      if (!bucketReturned && !bucketDropped) noteFail(bot, "drink_milk:bucket_lost", new Error("empty bucket return failed"));
      let still = false; try { still = !!(bot.getEffect?.("poison") || bot.getEffect?.("wither")); } catch {}
      r.lastUseItem = { act, ok: !still, reason: still ? "VERIFY_FAILED" : null, item: "minecraft:milk_bucket", cleared: removed, bucketReturned, bucketDropped, at: now }; commitLastAction(r, r.lastUseItem);
      if (still) noteFail(bot, "drink_milk:verify", new Error("effects remain after milk"), {expDone: true});
    }
  }
  // drink_fire_res: ポーション種別は typeId から識別不能のため消費しない (契約 POTION_KIND_UNKNOWN)。幻影の成功扱いはしない。
  if (act === "drink_fire_res") { r.lastUseItem = { act, ok: false, reason: "POTION_KIND_UNKNOWN", item: "minecraft:potion", at: Date.now() }; commitLastAction(r, r.lastUseItem); }
  if (act === "place_block_escape") stepBridgeEscape(bot, r, ctx); // ENV-02 (cycle0340)
  if (act.startsWith("deliver") && d < DELIVER_RANGE) {
    try { if (owner.dimension.id !== bot.dimension.id) { r.deliverFail = true; return; } } catch { r.deliverFail = true; return; } // cycle0659 F2 dim gate
    const oc = invOf(owner); if (!oc) return;
    const res = transferFiltered(bot, oc, deliverFilterFor(rule));
    if (res.moved > 0) { const st = stats(bot); st.deliver = (st.deliver || 0) + res.moved; saveStats(bot, st); r.justDelivered = true; r.deliveredFlag = true; system.runTimeout(() => { r.justDelivered = false; }, 100); dps(bot, "cb_bond", Math.min(100, dp(bot, "cb_bond", 30) + 1)); noteNod(r, res.moved); if (rule.act === "deliver_food") sayFromCategory(owner, bot, "deliver_food"); }
    r.deliverFail = res.failed; recordStore(r, "deliver", res);
  }
  if (act === "deposit" || act === "chest_alert") {
    const home = homeOf(bot); if (!home || home.dim !== bot.dimension.id) return;
    if (dist(bot.location, { x: home.x + 0.5, y: home.y + 1, z: home.z + 0.5 }) > DELIVER_RANGE) return;
    try { if (!r.depositGuard) r.depositGuard = createDepositGuardState(); } catch {}
    if (r.depositGuard && isDepositCooling(r.depositGuard, Date.now())) return; // cycle0659 F1 cooling
    let block = null; try { block = bot.dimension.getBlock(home); } catch {}
    const cc = block ? (() => { try { return block.getComponent("minecraft:inventory")?.container; } catch { return null; } })() : null;
    if (cc) {
      const res = transferFiltered(bot, cc, null);
      if (res.moved > 0) { const st = stats(bot); st.deposit = (st.deposit || 0) + res.moved; saveStats(bot, st); r.justDeposited = true; r.deliveredFlag = true; system.runTimeout(() => { r.justDeposited = false; }, 100); if (Math.random() < 0.5) say(owner, bot, genSpeech({ say: { item: "荷物", count: res.moved }, drops: { count: 0 }, flags: { bond: dp(bot, "cb_bond", 30) }, x: {} }, "deposit_report"));
      else sayFromCategory(owner, bot, "deposit_done"); }
      recordStore(r, "deposit", res);
      r.deliverFail = nextDepositDeliverFail(r.deliverFail, res); // cycle0659 F3
      try { const out = noteDepositOutcome(r.depositGuard, { moved: res?.moved || 0, failed: !!res?.failed }, Date.now()); if (out?.action === "cooldown") noteFail(bot, "deposit:full_cooldown", new Error("home container full")); if (out?.action === "progress") { const fP = { get coolCycles() { return r.depositCoolCycles || 0; }, set coolCycles(v) { r.depositCoolCycles = v; } }; resetDepositCoolCycles(fP); } } catch {} // cycle0900 C-2: 成功で周期カウンタを戻す
      if (res.failed) sayFromCategory(owner, bot, "chest_full");
    } else {
      // 拠点にコンテナが無い/読めない: 無言で成功扱いにせず、失敗として本人に認識させる
      noteFail(bot, "deposit:no_container", new Error("home container not found"));
      r.deliverFail = true;
      try { const out = noteDepositOutcome(r.depositGuard, { moved: 0, noContainer: true }, Date.now()); if (out?.action === "cooldown") noteFail(bot, "deposit:no_container_cooldown", new Error("home container not found (cooldown)")); } catch {} // cycle0659 F1
      if (Date.now() - (r.depFailSaidAt || 0) > 60000) { r.depFailSaidAt = Date.now(); say(owner, bot, "拠点のチェストが見つかりません。入庫できませんでした", true); }
    }
  }
  if (act === "rest_at_home") { const home = homeOf(bot); if (home && home.dim === bot.dimension.id && dist(bot.location, { x: home.x + 0.5, y: home.y + 1, z: home.z + 0.5 }) < 3) { try { const h = bot.getComponent("minecraft:health"); if (h && h.currentValue < h.effectiveMax) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + 2)); } catch {} } }
  if (ctx.x?.milestone) { r.lastMilestone = ctx.x.pickupTotal; say(owner, bot, `回収、累計${ctx.x.pickupTotal}個に到達しました。……記録、更新しておきました`, false); }
}

// ---------- 世界記憶 / 自律層 (v0.2) ----------
function wmemOf(bot) {
  const r = rt(bot);
  if (r.wmem !== null) return r.wmem;
  const oid = dp(bot, "cb_owner", ""); if (!oid) return null;
  try { r.wmem = createWorldMemory({ load: () => wdp(`cb_wmem:${oid}`, null), save: (s) => wdps(`cb_wmem:${oid}`, s) }); } catch { r.wmem = null; }
  return r.wmem;
}
const ITEM_JP = { diamond: "ダイヤモンド", emerald: "エメラルド", iron_ingot: "鉄インゴット", gold_ingot: "金インゴット", coal: "石炭", redstone: "レッドストーン", lapis_lazuli: "ラピスラズリ", quartz: "ネザークォーツ", raw_iron: "鉄の原石", raw_gold: "金の原石", raw_copper: "銅の原石", copper_ingot: "銅インゴット", netherite_ingot: "ネザライトインゴット", totem_of_undying: "不死のトーテム", elytra: "エリトラ", enchanted_book: "エンチャント本", wheat: "小麦", carrot: "ニンジン", potato: "ジャガイモ", beetroot: "ビートルート", apple: "リンゴ", bread: "パン", torch: "松明", oak_log: "オークの原木", spruce_log: "トウヒの原木", birch_log: "シラカバの原木", jungle_log: "ジャングルの原木", acacia_log: "アカシアの原木", dark_oak_log: "ダークオークの原木", cobblestone: "丸石", stone: "石", ancient_debris: "古代の残骸" };
const nameOfItem = (typeId) => ITEM_JP[typeId.split(":").pop()] || typeId.split(":").pop().replace(/_/g, " ");
function takeFromInv(bot, typeId, n) {
  const cont = invOf(bot); if (!cont) return false;
  for (let i = 0; i < cont.size; i++) { const it = cont.getItem(i); if (it && it.typeId === typeId && it.amount >= n) { cont.setItem(i, it.amount === n ? undefined : new ItemStack(typeId, it.amount - n)); return true; } }
  return false;
}
const ORE_DROPS = [[/diamond_ore$/, "minecraft:diamond", 1], [/emerald_ore$/, "minecraft:emerald", 1], [/coal_ore$/, "minecraft:coal", 1], [/iron_ore$/, "minecraft:raw_iron", 1], [/nether_gold_ore$/, "minecraft:gold_nugget", 3], [/gold_ore$/, "minecraft:raw_gold", 1], [/copper_ore$/, "minecraft:raw_copper", 2], [/lapis_ore$/, "minecraft:lapis_lazuli", 4], [/redstone_ore$/, "minecraft:redstone", 4], [/quartz_ore$/, "minecraft:quartz", 1], [/ancient_debris/, "minecraft:ancient_debris", 1], [/^minecraft:stone$/, "minecraft:cobblestone", 1], [/^minecraft:deepslate$/, "minecraft:cobbled_deepslate", 1]];
const CROP_DROPS = { "minecraft:wheat": ["minecraft:wheat", 1], "minecraft:carrots": ["minecraft:carrot", 2], "minecraft:potatoes": ["minecraft:potato", 2], "minecraft:beetroot": ["minecraft:beetroot", 1] };
// forbids G6-c (cycle0628): 自律作業対象のドロップ id アダプタ (表は既存 ORE_DROPS/CROP_DROPS が単一の正、純粋核へは埋め込まない)
const dropOfWorkTarget = (typeId) => { try { const c = CROP_DROPS[typeId]; if (c) return c[0]; } catch {} try { for (const [re, item] of ORE_DROPS) if (re.test(typeId)) return item; } catch {} return null; };
// Phase 6 (v0.4.78): 自律Goal gather_stone の知覚分類。部分一致でなく完全一致集合（stone_bricks 等の人工ブロック誤掘防止、cycle0312-a02）
const NATURAL_STONE = new Set(["minecraft:stone", "minecraft:deepslate", "minecraft:andesite", "minecraft:diorite", "minecraft:granite", "minecraft:tuff", "minecraft:calcite", "minecraft:cobblestone", "minecraft:mossy_cobblestone", "minecraft:netherrack", "minecraft:basalt", "minecraft:smooth_basalt", "minecraft:blackstone", "minecraft:end_stone"]);
const VALUABLE_ORES = new Set(["minecraft:diamond_ore", "minecraft:deepslate_diamond_ore", "minecraft:emerald_ore", "minecraft:deepslate_emerald_ore", "minecraft:ancient_debris"]);
const GATHER_TARGETS = { gather_wood: "tree", mine_ore: "ore", farm_crops: "crop", gather_stone: "stone" }; // 自律Goal→知覚スロットの汎用表（tickAutonomy）
const ARTIFICIAL_HINTS = ["planks", "door", "glass", "chest", "furnace", "crafting_table", "bookshelf", "lantern", "sign", "ladder", "fence", "stairs", "slab", "wool", "carpet", "concrete", "terracotta", "brick", "anvil", "enchanting", "brewing", "shulker", "barrel", "tnt", "beacon", "hopper", "orbital_foundry:"]; // v0.4.76 a22 V6: barrel/tnt/beacon/hopper の欠落を是正 (データ追加) / 0-C6(b) cycle1155: "bed" の部分一致が minecraft:bedrock に一致する誤判定を是正し、ベッド判定は isArtificialId の末尾一致へ分離
function isArtificialId(id) { try { if (typeof id !== "string") return false; if (id.endsWith(":bed") || id.endsWith("_bed")) return true; return ARTIFICIAL_HINTS.some((h) => id.includes(h)); } catch { return false; } }
function structureGuard(dim, loc) {
  for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0],[0,-1,0]]) {
    try { const b = dim.getBlock({ x: loc.x + dx, y: loc.y + dy, z: loc.z + dz }); if (b && isArtificialId(b.typeId)) return true; } catch {}
  }
  return false;
}
// 作業対象の硬さ (startWork の hardOf を単一の正として切り出し v0.4.88。tickWork の dig_first 差し替えと共用)
function workHardOf(id) { return CROP_DROPS[id] ? 1 : /_leaves$/.test(id) ? 1 : id.includes("_log") || (id.endsWith("_stem") && /(crimson|warped)/.test(id)) ? 3 : /deepslate|diamond|emerald/.test(id) ? 6 : 4; }

function startWork(bot, r, target, opts = {}) {
  if (!target) return false;
  // v0.4.59 (外部レビュー指摘1): 原木/幹は、同じ幹の一番下を対象にする。上の原木を狙うと
  // 葉の上でホバーして掘る距離 (3D 2.9) に届かず詰む。進捗保持の同一判定より前に寄せる。
  if (target.typeId && isTrunkType(target.typeId)) {
    try {
      const res = resolveTrunkBase(target, (p) => { const b = bot.dimension.getBlock(p); return b ? b.typeId : null; });
      if (res && res.resolved && res.loc && (res.loc.x !== target.x || res.loc.y !== target.y || res.loc.z !== target.z)) target = { ...target, x: res.loc.x, y: res.loc.y, z: res.loc.z };
    } catch {}
  }
  // cycle0832 F5: work層 ban 中の対象は立てない (hold枯渇で見切った到達不能候補の再選出ループを断つ)
  try { if (isWorkBanned(r.workBan, target, target.typeId, Date.now())) { r.lastWorkReject = { reason: "WORK_BANNED", typeId: target.typeId, at: Date.now() }; return false; } } catch {}
  // 同じ対象なら進捗を保持する。脳tickごとに作り直すと left がリセットされ永遠に割り切れない（実害バグ）
  if (r.work && r.work.typeId === target.typeId && r.work.loc.x === target.x && r.work.loc.y === target.y && r.work.loc.z === target.z) return true;
  // v0.4.76 遮蔽除去: 先掘り中は主対象 (main) が一致すれば先掘り対象の進捗を保持する
  if (r.work && r.work.main && r.work.main.typeId === target.typeId && r.work.main.loc.x === target.x && r.work.main.loc.y === target.y && r.work.main.loc.z === target.z) return true;
  if (structureGuard(bot.dimension, target) && !isCropBlock(target.typeId)) { r.lastWorkReject = { reason: "STRUCTURE_GUARD", typeId: target.typeId, at: Date.now() }; return false; } // cycle0659 HV1c: crops exempt + record
  stashWorkProgress(r, workHardOf, Date.now()); // A06-03 (cycle0224): 差替確定点で現行 work の掘削進捗を退避する
  const hardOf = workHardOf; // v0.4.88: 単一の正は workHardOf (tickWork の dig_first 差し替えと共用)
  const hard = hardOf(target.typeId);
  // v0.4.76 遮蔽除去 (一般規則、basics-leaves-work DESIGN §3): 作業現場の近くでのみ、立ち位置の目→対象の区間と
  // 立ち位置の有無を評価し、遮っている/立ち位置を塞いでいる「壊してよい自然ブロック」を先に掘る。
  // 人工物・岩盤・溶岩近接・道具不足は canBreakForPath の既存安全判定に委ね、先掘りできない場合は従来動作へ戻る。
  let accessStand = null; // crown統合 (v0.4.87): resolveWorkAccess が検証した立ち位置。tickWork が優先する
  try {
    const p = bot.location;
    if (!opts.skipAccess && p && Math.hypot(target.x + 0.5 - p.x, target.y + 0.5 - (p.y + 1.6), target.z + 0.5 - p.z) <= 12) {
      const dim = bot.dimension;
      const blockAt = (x, y, z) => { try { const b = dim.getBlock({ x, y, z }); if (!b) return null; return { typeId: b.typeId, solid: solidOfTypeId(b.typeId), liquid: !!b.isLiquid }; } catch { return null; } };
      const canBreak = (cell, block) => { try { if (isCropBlock(block.typeId)) { const bb = dim.getBlock(cell); let g = null; try { g = bb?.permutation?.getState("growth") ?? bb?.permutation?.getState("age"); } catch {} if (!isCropMature(block.typeId, g)) return false; } return canBreakForPath(bot, cell, { typeId: block.typeId, isLiquid: !!block.liquid }); } catch { return false; } }; // cycle1543 収穫A-F1 第2段: 未成熟作物を先掘り候補から除外
      const key = `${target.typeId}@${target.x},${target.y},${target.z}`;
      const chain = (r.workChain && r.workChain.key === key) ? (r.workChain.n || 0) : 0;
      const feetCell = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) };
      const res = resolveWorkAccess(blockAt, canBreak, { x: p.x, y: p.y + 1.6, z: p.z }, target, { chain, feetCell });
      if (res && res.stand) accessStand = { x: res.stand.x, y: res.stand.y, z: res.stand.z };
      if (res && res.kind === "dig_first" && res.cell && res.block) {
        r.workChain = { key, n: chain + 1 };
        r.work = { loc: { x: res.cell.x, y: res.cell.y, z: res.cell.z }, typeId: res.block.typeId, left: takeStashedLeft(r, res.cell, res.block.typeId, hardOf(res.block.typeId), Date.now()) ?? hardOf(res.block.typeId), main: { loc: { x: target.x, y: target.y, z: target.z }, typeId: target.typeId }, via: res.via || null, stand: accessStand, gateVia: opts.skipAccess ? "tunnel" : "work" }; // A06-03: 退避済み進捗があれば復元
        return true;
      }
      if (res && res.kind === "work") r.workChain = { key, n: 0 };
    }
  } catch {}
  r.work = { loc: { x: target.x, y: target.y, z: target.z }, typeId: target.typeId, left: takeStashedLeft(r, target, target.typeId, hard, Date.now()) ?? hard, stand: accessStand, gateVia: opts.skipAccess ? "tunnel" : "work" }; // A06-03: 退避済み進捗があれば復元
  return true;
}
// v0.4.56 (外部レビュー指摘3): 掘削の道具等級。バニラの必要等級に合わせ、足りない道具では掘らず理由つきで止まる
// (bootstrap の「道具を自作する」計画と実行部を一致させる)。等級: 木/金=1 石=2 鉄=3 ダイヤ/ネザライト=4。
function requiredPickLevel(typeId) {
  if (/ancient_debris|obsidian/.test(typeId)) return 4;
  if (/diamond_ore|emerald_ore|redstone_ore|gold_ore/.test(typeId)) return 3;
  if (/iron_ore|lapis_ore/.test(typeId)) return 2;
  if (/stone|cobblestone|coal_ore|copper_ore|andesite|diorite|granite|tuff|deepslate|netherrack/.test(typeId)) return 1;
  return 0;
}
function bestPickLevel(bot) {
  const inv = countInv(bot); let best = 0;
  for (const id of Object.keys(inv || {})) {
    if (!id.endsWith("_pickaxe")) continue;
    const lv = id.includes("netherite") || id.includes("diamond") ? 4 : id.includes("iron") ? 3 : id.includes("stone") ? 2 : 1;
    if (lv > best) best = lv;
  }
  return best;
}
// v0.4.65: 掘る対象ブロックの横（同じ高さ→1段下→2段下）で、体と頭が入る空きマスを立ち位置にする。
// 以前は対象ブロックの中心（固体の中）を移動目標にしていたため、飛行が対象自身を障害物と見て上昇・周回していた。
const WORK_REACH = 4.0; // 目の高さからブロック中心まで（プレイヤーの手の届く範囲より少し短め）
// 要望バッチA (v0.4.88): dig_gate へ渡す blockAt の単一実装。solid は正式版に無い固体プロパティを読まず solidOfTypeId で導出 (キュー1の教訓)
function digBlockAt(bot) {
  const dim = bot.dimension;
  return (x, y, z) => { try { const b = dim.getBlock({ x, y, z }); if (!b) return null; return { typeId: b.typeId, solid: solidOfTypeId(b.typeId), liquid: !!b.isLiquid }; } catch { return null; } };
}
// 要望バッチA (v0.4.88): tickWork の掘削瞬間に見つけた遮蔽セルへ作業を差し替える (startWork の dig_first と同型)
function swapWorkToOccluder(bot, r, w, gate) {
  const cell = gate.cell, block = gate.block;
  if (!cell || !block) return false;
  // cycle1543 収穫A-F1 第2段: 未成熟作物は遮蔽として先掘りしない (掘ってよい遮蔽ではない)
  if (isCropBlock(block.typeId)) {
    try { const bb = bot.dimension.getBlock(cell); let g = null; try { g = bb?.permutation?.getState("growth") ?? bb?.permutation?.getState("age"); } catch {} if (!isCropMature(block.typeId, g)) return false; } catch { return false; }
  }
  try { if (!canBreakForPath(bot, cell, { typeId: block.typeId, isLiquid: !!block.liquid })) return false; } catch { return false; }
  const main = w.main || { loc: { x: w.loc.x, y: w.loc.y, z: w.loc.z }, typeId: w.typeId };
  const key = `${main.typeId}@${main.loc.x},${main.loc.y},${main.loc.z}`;
  const chain = (r.workChain && r.workChain.key === key) ? (r.workChain.n || 0) : 0;
  if (chain >= ACCESS.MAX_CHAIN) return false;
  r.workChain = { key, n: chain + 1 };
  stashWorkProgress(r, workHardOf, Date.now()); // A06-03 (cycle0224): 差替前の本対象の進捗を退避
  r.work = { loc: { x: cell.x, y: cell.y, z: cell.z }, typeId: block.typeId, left: takeStashedLeft(r, cell, block.typeId, workHardOf(block.typeId), Date.now()) ?? workHardOf(block.typeId), main, via: gate.why || "occluded", stand: w.stand || null, gateVia: w.gateVia || "work" };
  return true;
}
function workStandPoint(bot, loc) {
  const dim = bot.dimension, p = bot.location;
  const free = (x, y, z) => { try { const b = dim.getBlock({ x, y, z }); if (!b) return false; return !solidOfTypeId(b.typeId) && !b.isLiquid; } catch { return false; } };
  for (const dy of ACCESS.STAND_DY) { // 探索順は work_access の ACCESS が単一の正 (crown統合 v0.4.87)。幹の上のほうは、樹冠の下（地面側）から手を伸ばす
    let best = null;
    for (const [dx, dz] of ACCESS.DIRS) {
      const x = loc.x + dx, y = loc.y + dy, z = loc.z + dz;
      if (!free(x, y, z) || !free(x, y + 1, z)) continue;
      const d = Math.hypot(x + 0.5 - p.x, z + 0.5 - p.z);
      if (!best || d < best.d) best = { x: x + 0.5, y, z: z + 0.5, d };
    }
    if (best) return { x: best.x, y: best.y, z: best.z };
  }
  return null;
}
function noteWorkHold(bot, r, w, why) {
  try {
    const now = Date.now();
    // WORKHOLD-KEYFLAP 是正 (cycle0252): 累計キーはセル+typeId (branchhold 是正と同型)。why は同一セルでも隣接読取の成否や呼出点の違いで揺らぎ、キーに含めると累計が毎回リセットされ30秒見切りが到達不能になるため診断用に wh.lastWhy へ保持するだけにする。加算も間隔2000ms以上の丸ごと破棄から1回最大2000msのキャップ加算へ是正する。
    const key = `${w.loc.x},${w.loc.y},${w.loc.z}|${w.typeId}`;
    if (!r.workHoldLeg || r.workHoldLeg.key !== key) r.workHoldLeg = { key, totalMs: 0, lastAt: now, left: w.left, noted: false };
    const wh = r.workHoldLeg;
    wh.lastWhy = why || wh.lastWhy || "";
    if (w.left < wh.left) wh.totalMs = 0;
    wh.left = w.left;
    if (wh.lastAt && now > wh.lastAt) wh.totalMs += Math.min(now - wh.lastAt, 2000);
    wh.lastAt = now;
    if (!wh.noted) { wh.noted = true; noteFail(bot, "work:hold", new Error(key)); }
    if (wh.totalMs > 30000) { noteFail(bot, "work:hold_exhausted", new Error(key)); try { if (!r.workBan) r.workBan = createWorkBanState(); const bt = w.main || w; recordWorkBan(r.workBan, bt.loc || bt, bt.typeId, now); pruneWorkBans(r.workBan, now); } catch {} return false; } // cycle0832 F5: 枯渇時に主対象 (遮蔽セルでなく w.main) を60秒 ban
  } catch {}
  return true;
}
function tickWork(bot, owner, r, ctx) {
  if (!r.work) return false;
  const w = r.work;
  w.touchedAt = Date.now(); // v0.4.68: 最後に実際に掘った時刻 (途中で止まった古い作業を見分ける)
  if (ctx.danger.nearestDist < 4 || ctx.x?.bossNear) { r.work = null; return false; }
  let b = null; try { b = bot.dimension.getBlock(w.loc); } catch {}
  if (!b || b.typeId !== w.typeId) { r.work = null; return false; }
  // cycle1543 収穫A-F1: 作物の成熟は BREAK の前提条件 (単一の正は crop_maturity.js)。
  // 選定経路ごとに足すと漏れるため、全経路の合流点である掘進直前で fail-closed に塞ぐ。
  // 未成熟なら掘らず、固定対象がその株なら固定も外して探索へ戻す (45秒固着の増幅を断つ)。
  if (isCropBlock(w.typeId)) {
    let g = null; try { g = b.permutation?.getState("growth") ?? b.permutation?.getState("age"); } catch {}
    const cg = cropBreakGate(w.typeId, g);
    if (cg && !cg.ok) {
      r.lastBreak = { act: "BREAK", ok: false, reason: cg.reason, item: w.typeId, at: Date.now() }; commitLastAction(r, r.lastBreak);
      if (r.mTargetLoc && r.mTargetLoc.x === w.loc.x && r.mTargetLoc.y === w.loc.y && r.mTargetLoc.z === w.loc.z) r.mTargetLoc = null;
      r.work = null; return false;
    }
  }
  // forbids 実行直前ゲート B案 (cycle0936, G6-a 部分解消): 上流を経ない経路・作業開始後に
  // 記録された禁止・mission 開始時スナップショットに無い禁止を、掘進直前で fail-closed に塞ぐ。
  // 照合は純粋核 isForbiddenWorkTarget (gather 意味論)。呼び出し側の例外は blocked=true へ倒す。
  {
    let fbBlocked = false;
    try { fbBlocked = isForbiddenWorkTarget(r.sessionForbids, w.typeId, dropOfWorkTarget) === true; } catch { fbBlocked = true; }
    if (fbBlocked) {
      r.lastBreak = { act: "BREAK", ok: false, reason: "FORBIDDEN", item: w.typeId, at: Date.now() }; commitLastAction(r, r.lastBreak);
      if (r.mTargetLoc && r.mTargetLoc.x === w.loc.x && r.mTargetLoc.y === w.loc.y && r.mTargetLoc.z === w.loc.z) r.mTargetLoc = null;
      r.work = null; return false;
    }
  }
  const reqLv = requiredPickLevel(w.typeId);
  if (reqLv > 0 && bestPickLevel(bot) < reqLv) {
    r.lastBreak = { act: "BREAK", ok: false, reason: "TOOL_INSUFFICIENT", item: w.typeId, at: Date.now() }; commitLastAction(r, r.lastBreak);
    r.toolNeed = { reqLv, item: w.typeId, at: Date.now() }; // cycle0922 (a02): 道具準備 leg への汎用シグナル (消費点は計画層)
    if (!r.toolWarnAt || Date.now() - r.toolWarnAt > 60000) { r.toolWarnAt = Date.now(); try { say(owner, bot, `${nameOfItem(w.typeId)}を掘るには、もっと良いツルハシが必要です`, true); } catch {} }
    r.work = null; return false;
  }
  const blockPt = { x: w.loc.x + 0.5, y: w.loc.y, z: w.loc.z + 0.5 };
  // crown統合 (v0.4.87): startWork が検証した立ち位置 (crown 判定済み) があれば優先する。
  // 記録が古くなって塞がれていた場合は従来の再計算へ落とす (体・頭セルの再検証のみ)。
  let verifiedStand = null;
  if (w.stand && Number.isFinite(w.stand.x) && Number.isFinite(w.stand.y) && Number.isFinite(w.stand.z)) {
    try {
      const dim2 = bot.dimension;
      const cellFree = (x, y, z) => { const b = dim2.getBlock({ x, y, z }); return !!b && !solidOfTypeId(b.typeId) && !b.isLiquid; };
      if (cellFree(w.stand.x, w.stand.y, w.stand.z) && cellFree(w.stand.x, w.stand.y + 1, w.stand.z)) verifiedStand = { x: w.stand.x + 0.5, y: w.stand.y, z: w.stand.z + 0.5 };
    } catch {}
  }
  r.target = verifiedStand || workStandPoint(bot, w.loc) || blockPt; // v0.4.65: 移動目標は横の空きマス（無ければ従来どおりブロック位置）
  // v0.4.65: 届く距離はプレイヤーと同じく「目の高さ→ブロック中心」で測る（足元基準だと幹の上や樹冠の下で届かない）
  const eye = { x: bot.location.x, y: bot.location.y + 1.6, z: bot.location.z };
  // 要望バッチA (v0.4.88): 掘削ゲート。距離だけでなく「目から最初にぶつかる固体か」「開いた空間に面しているか」を掘削の瞬間に検査する。w.left は dig のときだけ進める
  let gate = null;
  try { gate = evaluateDig(digBlockAt(bot), eye, w.loc, { reach: WORK_REACH, feetCell: { x: Math.floor(bot.location.x), y: Math.floor(bot.location.y), z: Math.floor(bot.location.z) }, via: w.gateVia || "work" }); } catch { gate = { action: "hold", why: "gate_error" }; } // 要望バッチA GAP-1 (cycle0821): ゲート例外時は fail-closed (距離のみで掘らない)
  if (!gate) { r.lastDigHold = { why: "gate_error", loc: { ...w.loc }, at: Date.now() }; if (!noteWorkHold(bot, r, w, "gate_error")) { r.work = null; r.workHoldLeg = null; return false; } return true; }
  else if (gate.action === "hold") {
    // cycle0922 キュー0残件: 1マス縦穴では横の立ち位置が無く、via=work の self_support が永久 hold になり
    // 出口のない停止になる (石層停止の残形、a01 実測で work/tunnel 不整合として確定)。
    // 開けた場所では支持保護 (M1) を維持し、立ち位置が無い場合に限り潜行とみなして tunnel 判定で再評価する。
    let retried = false;
    if (gate.why === "self_support" && (w.gateVia || "work") === "work") {
      let stand = null; try { stand = workStandPoint(bot, w.loc); } catch {}
      if (!stand) {
        try { const g2 = evaluateDig(digBlockAt(bot), eye, w.loc, { reach: WORK_REACH, feetCell: { x: Math.floor(bot.location.x), y: Math.floor(bot.location.y), z: Math.floor(bot.location.z) }, via: "tunnel" }); if (g2 && g2.action !== "hold") { gate = g2; retried = true; r.lastDigRetry = { why: "self_support_shaft", at: Date.now() }; } } catch {}
      }
    }
    if (!retried) { r.lastDigHold = { why: gate.why, loc: { ...w.loc }, at: Date.now() }; if (!noteWorkHold(bot, r, w, gate.why)) { r.work = null; r.workHoldLeg = null; return false; } return true; }
    if (gate.action === "dig_first") { if (!swapWorkToOccluder(bot, r, w, gate)) { r.lastDigHold = { why: "dig_first_unbreakable", loc: { ...w.loc }, at: Date.now() }; if (!noteWorkHold(bot, r, w, "dig_first_unbreakable")) { r.work = null; r.workHoldLeg = null; return false; } } else r.workHoldLeg = null; return true; }
  }
  else if (gate.action === "dig_first") { if (!swapWorkToOccluder(bot, r, w, gate)) { r.lastDigHold = { why: "dig_first_unbreakable", loc: { ...w.loc }, at: Date.now() }; if (!noteWorkHold(bot, r, w, "dig_first_unbreakable")) { r.work = null; r.workHoldLeg = null; return false; } } else r.workHoldLeg = null; return true; }
  r.workHoldLeg = null; // cycle0033 F2: hold escaped into digging = progress, clear the hold counter
  // POLISH-ANIM-LOOKLEAD-01 feeder (cycle2036): 破壊完了 (w.left tick 後) を予定行動とし、残り 250ms から視線を対象へ先行させる (表示層のみ・実機確認待ち)
  try {
    if (!r.lookleadState) r.lookleadState = createLookLeadState();
    const gr = gazeRotation(bot.location, { x: w.loc.x + 0.5, y: w.loc.y + 0.5, z: w.loc.z + 0.5 });
    let cur = null; try { cur = bot.getRotation(); } catch {}
    const yawTo = gr && cur ? ((gr.y - cur.y + 540) % 360) - 180 : 0;
    const pitchTo = gr && cur ? gr.x - cur.x : 0;
    let inWaterL = false; try { inWaterL = !!bot.isInWater; } catch {}
    const out = tickLookLead({ nowMs: Date.now(), msUntilAction: Math.max(0, (w.left - 1)) * 50, yawToNextDeg: yawTo, pitchToNextDeg: pitchTo, targetKey: `cell:${w.loc.x},${w.loc.y},${w.loc.z}`, suppressed: !!((ctx?.danger?.count ?? 0) > 0) || r.selfFalling === true || inWaterL, state: r.lookleadState });
    r.lookleadState = out.state; r.lookleadSample = out; r.lookleadSampleAt = Date.now();
    if (out.fired) r.lastLookLead = { at: Date.now(), targetKey: `cell:${w.loc.x},${w.loc.y},${w.loc.z}` };
  } catch {}
  w.left--;
  try { if (!r.sfxState) r.sfxState = createSfxState(); sfxDigHit(r.sfxState, bot.dimension, { x: w.loc.x + 0.5, y: w.loc.y + 0.5, z: w.loc.z + 0.5 }, w.typeId, Date.now()); } catch {} // 要望バッチF: 素材別の掘削音 (hit.*)
  if (w.left > 0) return true;
  try { b.setType("minecraft:air"); } catch (err) { r.lastBreak = { act: "BREAK", ok: false, reason: "SET_FAILED", item: w.typeId, at: Date.now() }; commitLastAction(r, r.lastBreak); noteFail(bot, "bts_break:set_failed", err, {expDone: true}); r.work = null; return false; } // RSN-04: 例外を成功形にしない (v0.4.7)
  clearStashFor(r, w.loc, w.typeId); // A06-03 (cycle0224): 完了セルの退避は使い切る
  try { sfxDigBreak(bot.dimension, { x: w.loc.x + 0.5, y: w.loc.y + 0.5, z: w.loc.z + 0.5 }, w.typeId); } catch {} // 要望バッチF: 素材別の破壊音
  let gain = CROP_DROPS[w.typeId] || null;
  if (!gain) for (const [re, item, n] of ORE_DROPS) if (re.test(w.typeId)) { gain = [item, n]; break; }
  if (!gain) { try { gain = dropTupleForBlock(w.typeId); } catch { gain = null; } } // 基礎 N1 (v0.4.65): CROP/ORE で決まらない決定的源は sourcing の dropItem/yield 下限が正 (メロン→スライス等)。確率源は block_drops が null を返す
  if (!gain && (w.typeId.includes("_log") || w.typeId.includes("_wood") || (w.typeId.endsWith("_stem") && /(crimson|warped)/.test(w.typeId)) || /granite$|diorite$|andesite$|tuff$|calcite$/.test(w.typeId))) gain = [w.typeId, 1];
  // v0.4.56 (外部レビュー指摘3): ドロップ表に無いブロックを壊して消滅させない。原則はブロック自身を落とす
  // (土・砂・砂利・ネザーラック等)。草ブロックはバニラどおり土、葉は素手では落とさない、岩盤は対象外。
  if (!gain && w.typeId === "minecraft:grass_block") gain = ["minecraft:dirt", 1];
  if (!gain && !/_leaves$/.test(w.typeId) && w.typeId !== "minecraft:bedrock") gain = [w.typeId, 1];
  if (gain) {
    const cont = invOf(bot); let rest = null;
    try { rest = cont ? cont.addItem(new ItemStack(gain[0], gain[1])) : new ItemStack(gain[0], gain[1]); } catch {}
    if (rest) { try { bot.dimension.spawnItem(rest, bot.location); } catch {} }
    const st = stats(bot); st.pickup = (st.pickup || 0) + gain[1]; saveStats(bot, st);
    say(owner, bot, genSpeech({ say: { item: nameOfItem(gain[0]), count: gain[1] }, drops: { count: ctx.drops.count }, flags: { bond: dp(bot, "cb_bond", 30) }, x: {} }, CROP_DROPS[w.typeId] ? "farm_comment" : w.typeId.includes("_log") ? "idle_thought" : "mine_comment"));
  }
  if (CROP_DROPS[w.typeId]) { // 植え直す
    const seedId = w.typeId === "minecraft:wheat" ? "minecraft:wheat_seeds" : w.typeId === "minecraft:beetroot" ? "minecraft:beetroot_seeds" : gain[0];
    if (takeFromInv(bot, seedId, 1)) { try { b.setType(w.typeId); try { sfxPlace(bot.dimension, { x: w.loc.x + 0.5, y: w.loc.y + 0.5, z: w.loc.z + 0.5 }, w.typeId); } catch {} } catch {} } // POLISH-SND-PLACE-01 残件 (cycle2036): 植え直しへの設置音配線 (表示層のみ)
  }
  r.lastBreak = { act: "BREAK", ok: true, reason: null, item: w.typeId, gained: gain ? gain[1] : 0, at: Date.now() }; commitLastAction(r, r.lastBreak);
  try { if (String(w.typeId || "").includes("_ore")) { const nb = veinNeighbors(w.loc, w.typeId, (p) => { try { const bb = bot.dimension.getBlock(p); return bb ? bb.typeId : null; } catch { return null; } }); const prev = filterBanned(Array.isArray(r.veinCands) ? r.veinCands.filter((c) => c && !(c.loc.x === w.loc.x && c.loc.y === w.loc.y && c.loc.z === w.loc.z)) : [], r.mBanKey, r.mBanUntil, Date.now()).filter((c) => !isBanned(c.loc, c.typeId ?? null, r.mBanKey, r.mBanUntil, Date.now())); /* 0-D1 (cycle1514): 登録段でも ban 中セルを持ち込まない */ const nbF = filterBanned(nb, r.mBanKey, r.mBanUntil, Date.now()); for (let i = nb.length - 1; i >= 0; i--) if (!nbF.includes(nb[i])) nb.splice(i, 1); const seen = new Set(prev.map((c) => `${c.loc.x},${c.loc.y},${c.loc.z}`)); for (const c of nb) { const k = `${c.loc.x},${c.loc.y},${c.loc.z}`; if (!seen.has(k)) { seen.add(k); prev.push(c); } } r.veinCands = capVeinCands(prev, bot.location); } } catch {} // 0-D1: 鉱脈の18近傍 (面+辺・角除外) を次候補として保持し上限は距離順 (D1-R2/R3 cyc2396)
  try { if (isTrunkType(w.typeId)) { const tnb = treeNeighbors(w.loc, w.typeId, (p) => { try { const bb = bot.dimension.getBlock(p); return bb ? bb.typeId : null; } catch { return null; } }, null); const prevT = filterBanned(Array.isArray(r.treeCands) ? r.treeCands.filter((c) => c && !(c.loc.x === w.loc.x && c.loc.y === w.loc.y && c.loc.z === w.loc.z)) : [], r.mBanKey, r.mBanUntil, Date.now()); r.treeCands = mergeTreeCands(prevT, filterBanned(tnb, r.mBanKey, r.mBanUntil, Date.now()), 32, bot.location); } } catch {} // 0-D3 R1: 同じ木の接続原木を次候補として保持 (上限は距離順 D3-R5 cyc2396)
  r.work = null;
  return true;
}
function wanderTo(r, bot, owner) {
  if (!r.wander || Date.now() - r.wanderAt > 9000 || dist(bot.location, r.wander) < 1.5) {
    const a = Math.random() * Math.PI * 2, rad = 8 + Math.random() * 7;
    r.wander = { x: owner.location.x + Math.cos(a) * rad, y: owner.location.y, z: owner.location.z + Math.sin(a) * rad };
    r.wanderAt = Date.now();
  }
  r.target = r.wander;
}
// ENV-02 実行部 (cycle0340): 足場脱出を1tickに1セル進める。設置は PLACE 統一の作法
// (takeFromInv→setType→検証→失敗時ロールバック)。人工物近傍 (structureGuard) では
// 開始せず hopeless 側へ倒す。完了判定は selfInLava 解除 (知覚側) に委ねる。
function stepBridgeEscape(bot, r, ctx) {
  const fail = (reason, err) => {
    try { if (!(r.lastPlace && r.lastPlace.reason === reason && Date.now() - (r.lastPlace.at || 0) < 5000)) { r.lastPlace = { act: "PLACE", mode: "bridge_escape", ok: false, reason, item: ctx?.x?.escapeBlockId || null, at: Date.now() }; commitLastAction(r, r.lastPlace); if (err) noteFail(bot, "place:bridge_" + String(reason).toLowerCase(), err); } } catch {}
    return false;
  };
  const blockId = ctx?.x?.escapeBlockId;
  if (!blockId) return fail("NO_MATERIAL");
  const sd = ctx?.x?.shoreDir || (r.shoreCache && r.shoreCache.dist < 999 ? { x: r.shoreCache.dirX, z: r.shoreCache.dirZ } : null);
  const bx = Math.floor(bot.location.x), by = Math.floor(bot.location.y), bz = Math.floor(bot.location.z);
  const stepX = sd ? Math.round(sd.x) : 1, stepZ = sd ? Math.round(sd.z) : 0;
  // 候補セル: まず足元-1 (ピラー)、埋まっていれば岸方向の次セルの足元-1 (橋)
  const candidates = [{ x: bx, y: by - 1, z: bz }, { x: bx + stepX, y: by - 1, z: bz + stepZ }];
  let cell = null, cur = null;
  for (const cand of candidates) {
    let b = null; try { b = bot.dimension.getBlock(cand); } catch (e) { return fail("API_ERROR", e); }
    if (b && (b.typeId === "minecraft:lava" || b.typeId === "minecraft:flowing_lava" || b.typeId === "minecraft:air")) { cell = cand; cur = b; break; }
  }
  if (!cell) { // 足元も次セルも固体 = 岸か中洲に乗っている。前進は移動層に委ねる
    try { r.lastPlace = { act: "PLACE", mode: "bridge_escape", ok: true, reason: "ON_SOLID", item: blockId, at: Date.now() }; commitLastAction(r, r.lastPlace); } catch {}
    return true;
  }
  try { if (structureGuard(bot.dimension, cell)) return fail("STRUCTURE_NEAR"); } catch {}
  if (!takeFromInv(bot, blockId, 1)) return fail("NO_MATERIAL");
  try {
    cur.setType(blockId);
    let placed = false; try { const rb = bot.dimension.getBlock(cell); placed = !!rb && rb.typeId === blockId; } catch {}
    if (!placed) throw new Error("bridge verify failed");
    if (!r.bridge) r.bridge = { blockId, placed: [], startedAt: Date.now(), phase: "bridge" };
    r.bridge.placed.push({ x: cell.x, y: cell.y, z: cell.z });
    if (r.bridge.placed.length > 128) r.bridge.placed.splice(0, r.bridge.placed.length - 128);
    r.bridgePlacedTotal = (r.bridgePlacedTotal || 0) + 1; // cyc2363 A20: 単調カウンタ (placed は128件で切り詰められ長さが進捗として不可視化するため、ENV-02 の進捗判定はこちらを使う)
    try { r.lastPlace = { act: "PLACE", mode: "bridge_escape", ok: true, reason: null, item: blockId, at: Date.now() }; commitLastAction(r, r.lastPlace); } catch {}
    try { sfxPlace(bot.dimension, { x: cell.x + 0.5, y: cell.y + 0.5, z: cell.z + 0.5 }, blockId); } catch {}
    return true;
  } catch (err) {
    try { const bc = invOf(bot); let rest = 1; if (bc) rest = addTo(bc, blockId, 1); if (rest > 0) bot.dimension.spawnItem(new ItemStack(blockId, rest), bot.location); } catch {}
    return fail("SET_FAILED", err);
  }
}
function placeTorch(bot, r, ctx) {
  // cycle2117 torchfix: silent return を廃止し全不成立を理由つきで記録する (同一理由は5秒間引きで連発を防ぐ)
  const fail = (reason, err) => {
    try { if (!(r.lastPlace && r.lastPlace.reason === reason && Date.now() - (r.lastPlace.at || 0) < 5000)) { r.lastPlace = { act: "PLACE", mode: "torch", ok: false, reason, item: "minecraft:torch", at: Date.now() }; commitLastAction(r, r.lastPlace); if (err) noteFail(bot, "place:torch_" + reason.toLowerCase(), err, {expDone: true}); } } catch {}
    return false;
  };
  if (!((ctx.x?.lightLevel ?? 15) <= 7)) return fail("NOT_DARK");
  if (!((ctx.x?.torchCount || 0) > 0)) return fail("NO_MATERIAL");
  let feet = null, below = null;
  try {
    feet = bot.dimension.getBlock({ x: Math.floor(bot.location.x), y: Math.floor(bot.location.y), z: Math.floor(bot.location.z) });
    below = bot.dimension.getBlock({ x: Math.floor(bot.location.x), y: Math.floor(bot.location.y) - 1, z: Math.floor(bot.location.z) });
  } catch (e) { return fail("API_ERROR", e); }
  if (!(feet && feet.typeId === "minecraft:air" && below && below.typeId !== "minecraft:air" && !below.isLiquid)) return fail("NO_SUPPORT");
  if (!takeFromInv(bot, "minecraft:torch", 1)) return fail("NO_MATERIAL");
  try {
    feet.setType("minecraft:torch");
    let placed = false; try { const rb = bot.dimension.getBlock({ x: Math.floor(bot.location.x), y: Math.floor(bot.location.y), z: Math.floor(bot.location.z) }); placed = !!rb && rb.typeId === "minecraft:torch"; } catch {}
    if (placed) { try { r.torchDone = { cell: `${Math.floor(bot.location.x)},${Math.floor(bot.location.y)},${Math.floor(bot.location.z)}`, dim: bot.dimension.id, at: Date.now() }; } catch {} try { r.lastPlace = { act: "PLACE", mode: "torch", ok: true, reason: null, item: "minecraft:torch", at: Date.now() }; commitLastAction(r, r.lastPlace); } catch {} try { sfxPlace(bot.dimension, { x: Math.floor(bot.location.x) + 0.5, y: Math.floor(bot.location.y) + 0.5, z: Math.floor(bot.location.z) + 0.5 }, "minecraft:torch"); } catch {} return true; } // 作り込み POLISH-SND-PLACE-01 (v0.4.90): 設置音の実配線 (表示層のみ)
    throw new Error("torch verify failed");
  } catch (err) {
    // Phase2 PLACE統一 (v0.4.9): station と同型に、消費後の設置失敗で松明を消失させない (ロールバック)
    try { const bc = invOf(bot); let rest = 1; if (bc) rest = addTo(bc, "minecraft:torch", 1); if (rest > 0) bot.dimension.spawnItem(new ItemStack("minecraft:torch", rest), bot.location); } catch {}
    try { r.lastPlace = { act: "PLACE", mode: "torch", ok: false, reason: "SET_FAILED", item: "minecraft:torch", at: Date.now() }; commitLastAction(r, r.lastPlace); } catch {}
    noteFail(bot, "place:torch_set_failed", err, {expDone: true});
  }
}
function tickAutonomy(bot, owner, ctx, effMove) {
  const r = rt(bot);
  if (tickWork(bot, owner, r, ctx)) return;
  const mode = dp(bot, "cb_mode", "follow");
  if (mode !== "free" && mode !== "work") return;
  if (ctx.danger.nearestDist < 7 || ctx.x?.bossNear) return;
  if (effMove && effMove.id !== "compiled_matrix" && (effMove.p || 0) >= 150 && !/^(mood_|fb_)/.test(effMove.id || "")) return; // mood_/fb_ は暇の表明。プランナーを飢餓させない
  const mem = { visitedChunks: [], dangerSpots: [], knownContainers: [], lastGoal: r.goal, goalSince: r.goalAt, now: Date.now() };
  // Phase1 Phase D: buildPlannerMem アダプタ（M1〜M3＋knownContainers を一括解消）。getVisited(cx,cz) は単一レコード返しのため visited は recentChunks、危険は dangerNear、コンテナは knownContainers から組み立てる
  try { const wm = wmemOf(bot); if (wm) {
    if (wm.recentChunks) mem.visitedChunks = wm.recentChunks(16, bot.dimension.id).map((v) => `${v.dim === "minecraft:nether" ? "n" : v.dim === "minecraft:the_end" ? "e" : v.dim === "minecraft:overworld" ? "o" : (v.dim ?? "o")}:${v.cx},${v.cz}`); // v0.4.79: recentChunks の dim は完全ID、currentChunk は短縮形 (o/n/e)。形式を揃えないと既踏判定が常時 false になる
    if (wm.dangerNear) mem.dangerSpots = wm.dangerNear(bot.location, bot.dimension.id, 32).map((s) => ({ x: s.x, z: s.z, r: 12, weight: s.weight, kind: s.kind }));
    if (wm.knownContainers) mem.knownContainers = wm.knownContainers(bot.dimension.id);
  } } catch {}
  let g = null; try { g = chooseGoal(ctx, mem); } catch {}
  if (!g) return;
  if (g.goal !== r.goal) { r.goal = g.goal; r.goalAt = Date.now(); if (mode === "free" && g.reason) say(owner, bot, g.reason); try { const gev = mapGoalEvent({ goal: g.goal, utility: g.utility, scores: Array.isArray(g.scores) ? g.scores.map((s) => [s?.goal, s?.utility]) : undefined, x: { hp: ctx.self?.hpPct ?? null, dg: ctx.danger?.count ?? null, scan: ctx.x?.obs?.scan ?? null, inv: ctx.x?.obs?.inv ?? null } }); if (gev) r.trace?.record(gev); } catch {} }
  switch (g.goal) {
    case "gather_wood": case "mine_ore": case "farm_crops": case "gather_stone": { const t0628 = r.percTargets?.[GATHER_TARGETS[g.goal]]; let blocked0628 = false; try { blocked0628 = !!t0628 && isForbiddenWorkTarget(r.sessionForbids, t0628.typeId, dropOfWorkTarget); } catch {} try { if (t0628 && isAllowedByAllowOnly(r.allowOnly, t0628.typeId, "gather") === false) blocked0628 = true; } catch {} if (blocked0628) wanderTo(r, bot, owner); else if (!startWork(bot, r, t0628)) wanderTo(r, bot, owner); break; } // forbids G6-c (cycle0628): 禁止対象は startWork へ渡さない (知覚選出の除外の防衛線) + U5-1 (cyc2387): allowOnly 許可外の知覚対象も自律選出では startWork へ渡さない
    case "place_torch_dark": { // cycle2117 torchfix: 足元へ降りる目標を張り syncFlyGoal の interact 降下に載せる (張るだけでは消費しない)
      try { r.target = { x: Math.floor(bot.location.x) + 0.5, y: Math.floor(bot.location.y), z: Math.floor(bot.location.z) + 0.5 }; r.moveAct = "place_torch"; } catch {}
      placeTorch(bot, r, ctx); break; }
    case "deposit_at_home": { // cycle0740 deposit P3: planDepositDecision を単一判断点にする (P1 planner ゲートとセット)
      const h = homeOf(bot); try { if (!r.depositGuard) r.depositGuard = createDepositGuardState(); } catch {}
      const nowD = Date.now(); const coolingD = !!(r.depositGuard && isDepositCooling(r.depositGuard, nowD)); const suppressedD = (r.depositHomeSuppressedUntil || 0) > nowD;
      const distD = h ? dist(bot.location, { x: h.x + 0.5, y: h.y + 1, z: h.z + 0.5 }) : null;
      const decD = planDepositDecision({ homePresent: !!h, homeDim: h?.dim ?? null, botDim: bot.dimension.id, distToHome: distD, range: DELIVER_RANGE, cooling: coolingD || suppressedD });
      if (decD.action === "attempt") { r.depositCoolSeen = false; r.target = { x: h.x + 0.5, y: h.y + 1, z: h.z + 0.5 }; execArrive(bot, owner, { act: "deposit" }, ctx, null); }
      else if (decD.action === "approach") { r.depositCoolSeen = false; r.target = { x: h.x + 0.5, y: h.y + 1, z: h.z + 0.5 }; }
      else { // yield: 目標を張らず主人へ寄って他 goal へ譲る。10分抑制の計数は cycle0900 で buildContext の冷却エッジ計数へ移設済み (ここでは数えない)
        try { r.target = behindOf(owner, 2); r.moveAct = "follow"; } catch {}
      } break; }
    case "deliver_to_owner": { // cycle1807 U1: 距離・次元ゲート無しの即時転送を是正 (DELIVER_RANGE が単一の正、範囲外は主人へ接近目標を張る)
      let inRange = false; try { inRange = owner.dimension.id === bot.dimension.id && dist(bot.location, owner.location) <= DELIVER_RANGE; } catch {}
      if (inRange) {
        // A18-TR-01 (cycle0446): 満杯全滅・inv取得不可の連続失敗に出口を持たせる。冷却中は試行せず主人へ寄るだけにし、他 goal へ譲る
        try { if (!r.deliverGuard) r.deliverGuard = createDeliverGuardState(); } catch {}
        if (r.deliverGuard && isDeliverCooling(r.deliverGuard, Date.now())) { try { r.target = behindOf(owner, 2); r.moveAct = "follow"; } catch {} }
        else {
          const oc = invOf(owner);
          if (oc) { const res = transferFiltered(bot, oc, null); recordStore(r, "deliver_to_owner", res);
            try { const out = noteDeliverOutcome(r.deliverGuard, { moved: res?.moved || 0, failed: !!res?.failed }, Date.now());
              if (out?.action === "cooldown") noteFail(bot, "planner:deliver_to_owner_full", new Error("owner inventory full"));
              else if (out?.action === "progress" && shouldDeliverBow({ delivered: true, suppressed: false, lastFiredMs: r.deliverBowLastAt ?? null, nowMs: Date.now() })) { r.deliverBowAt = Date.now(); r.deliverBowLastAt = r.deliverBowAt; r.lastDeliverBow = { at: r.deliverBowAt, moved: res?.moved || 0 }; }
            } catch {}
          } else {
            try { const out = noteDeliverOutcome(r.deliverGuard, { moved: 0, failed: false, invUnavailable: true }, Date.now()); if (out?.action === "cooldown") noteFail(bot, "planner:deliver_to_owner_full", new Error("owner inventory unavailable")); } catch {}
          }
        }
      }
      else { try { r.target = behindOf(owner, 2); r.moveAct = "follow"; } catch {} }
      break; }
    case "explore_nearby": wanderTo(r, bot, owner); break;
    case "return_home": { const h = homeOf(bot); const ep = homeEntryPoint(bot, h); if (ep) r.target = ep; else { try { r.target = behindOf(owner, 2); } catch {} } break; }
    case "rest_recover": {
      const h = homeOf(bot);
      if (!h) {
        // RR-01/RR-02 (cycle1153): hint={kind:"here"} 契約どおり、その場で既存 useHealItem へ委譲する (拠点なしで無作用の吸着を解消)。
        // 記録は execArrive use_heal_item と同一形式。act は互換のため "use_heal_item" を保ち、出自は via で区別する。
        const core = equipCoreOf(bot, r);
        if (!core) { r.lastUseItem = { act: "use_heal_item", ok: false, reason: "EQUIP_CORE_UNAVAILABLE", item: null, at: Date.now(), via: "rest_recover" }; commitLastAction(r, r.lastUseItem); }
        else { try { const res = core.useHealItem(); if (res?.reason !== "eating") { r.lastUseItem = { act: "use_heal_item", ok: !!res?.ok, reason: res?.reason || null, item: res?.item || null, at: Date.now(), via: "rest_recover" }; commitLastAction(r, r.lastUseItem); if (res?.ok) { try { sfxEat(bot.dimension, bot.location, res?.item || null); } catch {} } } } catch (e) { r.lastUseItem = { act: "use_heal_item", ok: false, reason: "API_ERROR", item: null, at: Date.now(), via: "rest_recover" }; commitLastAction(r, r.lastUseItem); noteFail(bot, "use_heal_item:exception", e, {expDone: true}); } }
        break;
      }
      const epR = homeEntryPoint(bot, h); if (epR) r.target = epR; else { try { r.target = behindOf(owner, 2); } catch {} }
      /* S-01 完了作用: 拠点到着後だけ回復する (R-02 の到着 gate と対)。HP>=0.95 で uRestRecover が 0 になり目標は自然に外れる */
      if (h.dim === bot.dimension.id && dist(bot.location, { x: h.x + 0.5, y: h.y + 1, z: h.z + 0.5 }) < 3) {
        try { const hc = bot.getComponent("minecraft:health"); if (hc && hc.currentValue < hc.effectiveMax) hc.setCurrentValue(Math.min(hc.effectiveMax, hc.currentValue + 2)); } catch {}
      }
      break;
    }
    default: break;
  }
}

// ---------- nav（経路探索。nav_integration.md の手順どおり） ----------
const probeCache = new Map(); // dimensionId -> probe
function probeFor(dim) {
  if (probeCache.has(dim.id)) return probeCache.get(dim.id);
  const probe = (x, y, z) => {
    let b = null;
    try { b = dim.getBlock({ x, y, z }); } catch { return cellUnknown(); }
    if (!b) return cellUnknown(); // 未読み込み等は未知セル（解釈は fly/nav の消費者側）
    let api = null;
    try { api = { isLiquid: b.isLiquid }; } catch {}
    return classifyTypeId(b.typeId, api);
  };
  probeCache.set(dim.id, probe);
  return probe;
}
function navOf(bot, r) {
  if (!r.nav || r.navDim !== bot.dimension.id) { r.nav = createNav(probeFor(bot.dimension)); r.navDim = bot.dimension.id; }
  return r.nav;
}
function syncNavGoal(bot, r) {
  try {
    const nav = navOf(bot, r);
    if (!r.target) { navClearGoal(nav); return; }
    const arriveRadius = (r.moveAct === "follow" || r.moveAct === "stay_anchor") ? 1 : 0;
    navSetGoal(nav, r.target, { arriveRadius });
  } catch {}
}
// v0.3.9: 飛行（ホバー移動）。fly.js が ground を返した時だけ nav/direct を使う。
const INTERACT_ACTS = new Set(["deposit", "chest_alert"]);
function flyOf(bot, r) {
  if (!r.fly || r.flyDim !== bot.dimension.id) { r.fly = createFly(probeFor(bot.dimension)); r.flyDim = bot.dimension.id; }
  return r.fly;
}
function syncFlyGoal(bot, r) {
  try {
    const fly = flyOf(bot, r);
    if (!FLY_ENABLE || !r.target) { flyClearGoal(fly); return; }
    const act = r.moveAct || "";
    const interact = INTERACT_ACTS.has(act) || act === "place_torch" || act.startsWith("pickup_") || act.startsWith("deliver") || !!r.work || (r.mission && (r.mission.status === "active" || r.mission.status === "suspended")) || (r.buildPlan && r.buildPlan.stage === "build"); // BLD1621-03 (cycle1640): 建築中も干渉プロファイルにする // queue1 fix1 (basics-digdown-dec): 保留中は branchmine の降下目標が出るため interact に含める。含めないと fly 非interact経路が目標を地面+1.2へクランプし潜行が永遠に始まらない (実測: 3000tick掘削0→81tick完走)
    flySetGoal(fly, r.target, { interact });
  } catch {}
}
// 移動ウォッチドッグ：目標が遠いのに「動いているのに進まない（振動）」または「完全停止」が続いたら、
// 目標方向へ小さくホップして物理的にループを断つ。8秒に1回まで。
// ground-walk Stage 0-B (cycle1703): record-only move helper
function noteMove(bot, r, engine) {
  try {
    if (!r.moveTracker || r.moveDim !== bot.dimension.id) { r.moveTracker = createMoveTracker(); r.moveDim = bot.dimension.id; }
    const tr = r.moveTracker;
    const pos = bot.location;
    let eng = engine;
    if (tr.prevPos && Math.hypot(pos.x - tr.prevPos.x, pos.y - tr.prevPos.y, pos.z - tr.prevPos.z) > 2.0) eng = "teleport";
    const dim = bot.dimension;
    const belowCell = { x: Math.floor(pos.x), y: Math.floor(pos.y - 0.5), z: Math.floor(pos.z) };
    let below = null; try { below = dim.getBlock(belowCell); } catch {}
    const grounded = !!below && solidOfTypeId(below.typeId) && !below.isLiquid;
    const st = moveTrackStep(tr, pos, 0.1, { engine: eng, nowMs: Date.now(), grounded, wet: !!bot.isInWater, getSurface: () => { try { const b = dim.getBlock(belowCell); return b && solidOfTypeId(b.typeId) ? b.typeId : "minecraft:air"; } catch { return "minecraft:air"; } } });
    if (st) r.moveState = st;
    r.moveEvents = drainMoveEvents(tr);
    // POLISH-ANIM-FALLLAND-01 (cycle0057): 落下/着地の判定は moveTracker の前回位置との dy で供給 (表示層のみ)
    try {
      if (!r.falllandState || r.falllandDim !== bot.dimension.id) { r.falllandState = createFallLandState(); r.falllandDim = bot.dimension.id; r.falllandPrevY = null; }
      const dy = typeof r.falllandPrevY === "number" ? pos.y - r.falllandPrevY : 0;
      if (eng === "teleport") { r.falllandState = createFallLandState(); }
      else { const ev = onVerticalStep(r.falllandState, dy, 0.1, grounded, Date.now()); if (ev && ev.event) r.lastFallLand = { at: Date.now(), event: ev.event, landTier: ev.landTier || 0, fallAmount: ev.fallAmount || 0 }; }
      r.falllandPrevY = pos.y;
    } catch {}
    // POLISH-ANIM-ROUTECHECK-01 (cycle0117): 累積水平距離は moveTracker の前回位置から供給 (新規走査なし・表示層のみ)
    try {
      if (!r.routecheckState || r.routecheckDim !== bot.dimension.id) { r.routecheckState = createRoutecheckState(); r.routecheckDim = bot.dimension.id; r.routecheckPrevPos = null; }
      const rp2 = r.routecheckPrevPos;
      const stepH = rp2 ? Math.hypot(pos.x - rp2.x, pos.z - rp2.z) : 0;
      const rcEv = noteRoutecheck(r.routecheckState, { moving: stepH > 0.01, stepDist: stepH, arrived: eng === "idle", falling: !grounded, inWater: !!bot.isInWater, justTeleported: eng === "teleport", working: !!r.work, danger: !!(((r.lastCtx?.danger?.count) ?? 0) > 0) }, Date.now());
      if (rcEv && rcEv.fired) r.lastRoutecheck = { at: Date.now(), reason: rcEv.reason, armPitchDeg: -30 };
      r.routecheckPrevPos = { x: pos.x, z: pos.z };
    } catch {}
  } catch {}
}
function movementWatchdog(bot, r, pos) {
  if (!r.target) return;
  const now = Date.now();
  if (now - (r.watchAt || 0) < 500) return;
  r.watchAt = now;
  r.watchHist.push({ x: pos.x, y: pos.y, z: pos.z, t: now }); // queue0-A bug1 (cycle1728): keep y for 3D stuck detection
  while (r.watchHist.length && now - r.watchHist[0].t > 6000) r.watchHist.shift();
  if (r.watchHist.length < 8) return;
  const t = r.target;
  // v0.4.59 (外部レビュー指摘4): 水平だけ見ると「真上だが高さが離れている」を到着扱いして救済が働かない
  if (Math.hypot(t.x - pos.x, t.z - pos.z) <= 3 && (typeof t.y !== "number" || Math.abs(t.y - pos.y) <= 2)) return;
  const first = r.watchHist[0];
  const net = Math.hypot(pos.x - first.x, (pos.y||0) - (first.y||0), pos.z - first.z); // queue0-A bug1: 3D
  let path = 0;
  for (let i = 1; i < r.watchHist.length; i++) path += Math.hypot(r.watchHist[i].x - r.watchHist[i - 1].x, (r.watchHist[i].y||0) - (r.watchHist[i - 1].y||0), r.watchHist[i].z - r.watchHist[i - 1].z); // queue0-A bug1: 3D
  const oscillating = path > 3 && net < 1.0;   // 行ったり来たりしている
  const frozen = path < 0.3 && r.stuckSec >= 3; // 全く動いていない
  if (!oscillating && !frozen) return;
  if (now - (r.lastHopAt || 0) < 8000) return; // BASICS-03残部: クールダウンは読むだけのゲート。消費は成功時のみ
  const dx = t.x - pos.x, dz = t.z - pos.z, hd = Math.hypot(dx, dz) || 1;
  const hx = pos.x + (dx / hd) * 2.5, hz = pos.z + (dz / hd) * 2.5;
  const gy = groundY(bot.dimension, hx, hz, pos.y, pos.y);
  let dest = { x: hx, y: Math.max(pos.y, gy + 1.2), z: hz };
  // BASICS-03残部: 行き先検査 (体・頭は dest.y 基準、支持は gy 基準)。安全でなければ飛ばず、何も消費しない
  if (!isSafeTeleportDest(probeFor(bot.dimension), dest, gy)) return;
  // queue3 step1 (basics-clip-audit, cycle0504): 区間検査つき統一ゲート。着地だけでなく間の列も見る。
  // go=そのまま / shift=壁の手前で止まる位置へ差し替え / hold=飛ばない (何も消費しない)。例外時は従来 dest のまま (ゲート障害で救済自体を止めない)。
  try { const gate = guardedTeleport(probeFor(bot.dimension), pos, dest, { mode: "hop" }); if (gate.action === "hold") return; if (gate.action === "shift" && gate.dest) dest = gate.dest; r.lastHopGate = { action: gate.action, why: gate.why || null, at: now }; } catch {}
  let hopped = false;
  try { bot.teleport(dest); const nl = bot.location; hopped = !!nl && Math.hypot(nl.x - dest.x, nl.z - dest.z) < 1.0 && Math.abs(nl.y - dest.y) < 2.0; } catch {}
  if (!hopped) return; // 失敗 (例外・無言失敗): クールダウン/履歴/stuckSec/nav目標を全て保持し次サンプルで再試行
  r.lastHopAt = now; r.watchHist = []; r.stuckSec = 0;
  try { navClearGoal(navOf(bot, r)); } catch {}
}
function setDoor(dim, cell, open) {
  try {
    const b = dim.getBlock(cell);
    if (!b) return;
    b.setPermutation(b.permutation.withState("open_bit", open));
  } catch {}
}
function applyDoors(bot, res, r) {
  for (const d of res.openDoors || []) setDoor(bot.dimension, d, true);
  for (const d of res.closeDoors || []) setDoor(bot.dimension, d, false);
}
// 現行方式の直接移動（nav のフォールバックとして温存）
function moveDirect(bot, r) {
  if (!r.target) return;
  const p = bot.location; const t = r.target;
  const dx = t.x - p.x, dz = t.z - p.z; const hd = Math.hypot(dx, dz);
  let nx = p.x, nz = p.z;
  if (hd > 0.5) { const step = Math.min(0.85, hd); nx = p.x + (dx / hd) * step; nz = p.z + (dz / hd) * step; }
  const ngy = groundY(bot.dimension, nx, nz, p.y, p.y);
  const ny = Math.max(Math.min(ngy, p.y + 1.25), p.y - 2.5);
  // v0.4.66/69: 足元が固ければ上面へ持ち上げ、それでも体・目が入らないなら動かない (岩の中へのテレポート＝窒息を防ぐ)
  let liftedY = ny; try { const lf = liftFeet(bot.dimension, { x: nx, y: ny, z: nz }); if (!lf || lf.y > p.y + 1.25) { r.stuckSec += 0.1; r.lastPos = { ...p }; return; } liftedY = lf.y; } catch {}
  try { if (hd > 0.5) bot.teleport({ x: nx, y: liftedY, z: nz }, { rotation: { x: 0, y: yawToward(dx, dz) } }); else bot.teleport({ x: nx, y: liftedY, z: nz }); } catch {} // heading H1: fly/nav 経路と同様に進行方向を向く
  // ハマり検出
  if (r.lastPos && Math.hypot(p.x - r.lastPos.x, p.z - r.lastPos.z) < 0.05 && (typeof t.y === "number" ? Math.hypot(p.x - t.x, p.y - t.y, p.z - t.z) : hd) > 2) r.stuckSec += 0.1; else r.stuckSec = 0; // queue0-A bug1 (cycle1728): 3D distance (was horizontal-only, so targets below never accumulated stuck)
  r.lastPos = { ...p };
}


// ---------- v0.4.68: 埋まり防止・邪魔なブロックの除去・安全な瞬間移動 ----------
// 体が入るマス: 足・胴・目 (足 +1.62)。目の高さは端数で 2 マス上になる
function bodyCells(loc) {
  const x = Math.floor(loc.x), z = Math.floor(loc.z), ys = [...new Set([Math.floor(loc.y), Math.floor(loc.y + 1), Math.floor(loc.y + 1.62)])];
  return ys.map((y) => ({ x, y, z }));
}
function solidAt(dim, c) { try { const b = dim.getBlock(c); return !!b && solidOfTypeId(b.typeId) && !b.isLiquid; } catch { return false; } }
// 体・目が入り、溶岩でない場所を loc の近くから探す (上方向を優先)。見つからなければ null
function safeSpotNear(dim, loc, opts = {}) {
  const bx = Math.floor(loc.x), by = Math.floor(loc.y), bz = Math.floor(loc.z);
  const offs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];
  const dys = opts.upFirst ? [0, 1, 2, 3, 4, 5, 6, 7, 8, -1] : [0, 1, -1, 2, 3, -2, 4];
  for (const dy of dys) for (const [dx, dz] of offs) {
    const x = bx + dx, y = by + dy, z = bz + dz;
    let ok = true;
    for (const c of bodyCells({ x: x + 0.5, y, z: z + 0.5 })) { try { const b = dim.getBlock(c); if (!b || (solidOfTypeId(b.typeId) && !b.isLiquid) || b.typeId.includes("lava") || /fire|cactus|sweet_berry|powder_snow/.test(b.typeId)) { ok = false; break; } } catch { ok = false; break; } }
    if (ok) return { x: x + 0.5, y, z: z + 0.5 };
  }
  return null;
}
// queue3 step2 (basics-clip-audit §4-2, cycle0517): フォールバック3件 (catchup/召喚/go_owner) + spawn の place 共通化。
// 位置設定は単一ゲート (teleport_gate) を通す。候補を順に place モードで検査し go/shift のときだけ置く。
// 最終候補は主人の位置そのもの (ブロック的には定義上空いている)。全候補 hold なら置かない
// (現位置維持。次 tick / 次回呼び出しで再試行する)。従来の無検査フォールバック (|| behind / || want) は廃止。
function placeGateDest(dim, from, want) {
  try {
    const gate = guardedTeleport(probeFor(dim), from || want, want, { mode: "place" });
    if ((gate.action === "go" || gate.action === "shift") && gate.dest) return { dest: gate.dest, action: gate.action };
    return { dest: null, action: "hold", why: gate.why || null };
  } catch { return { dest: null, action: "hold", why: "gate_error" }; }
}
function teleportNearOwnerGuarded(entity, r, dim, want, ownerLoc) {
  const cands = [];
  const push = (v) => { if (v && !cands.some((c) => c.x === v.x && c.y === v.y && c.z === v.z)) cands.push(v); };
  push(safeSpotNear(dim, want)); push(ownerLoc ? safeSpotNear(dim, ownerLoc) : null); push(want); push(ownerLoc ? { ...ownerLoc } : null);
  for (const c of cands) {
    const g = placeGateDest(dim, entity.location, c);
    if (r) r.lastPlaceGate = { action: g.action, why: g.why || null, at: Date.now() };
    if (g.dest) { try { entity.teleport(g.dest, { dimension: dim }); return true; } catch { continue; } } // cycle1400 a20 S-2: 1候補目の例外で諦めず次の候補を試す
  }
  return false;
}
// queue3 step3 (basics-clip-audit §4-3 + basics-suffocate guardedStepTeleport 統合, cycle0543):
// 坑道の前進/帰路テレポートは tunnel ゲートを通す。掘れる自然ブロックは外から掘ってから入る。
// hold のときは入らない (呼び出し側は前進なら steps を進めず、帰路なら step を消費しない)。
function tunnelGateDest(bot, r, dest) {
  try {
    const dim = bot.dimension;
    const canDig = (cell) => { try { const b = dim.getBlock(cell); return !!b && canBreakForPath(bot, cell, b); } catch { return false; } };
    const gate = guardedTeleport(probeFor(dim), bot.location, dest, { mode: "tunnel", canDig });
    if (gate.action === "dig" && gate.cells) {
      let dug = true;
      for (const c of gate.cells) if (!breakForPath(bot, r, c, { via: "tunnel" })) { dug = false; break; }
      if (!dug) { r.lastTunnelGate = { action: "hold", why: "dig_failed", at: Date.now() }; return { dest: null, action: "hold" }; }
      r.lastTunnelGate = { action: "go", why: "dug", at: Date.now() };
      return { dest: gate.dest, action: "go" };
    }
    r.lastTunnelGate = { action: gate.action, why: gate.why || null, at: Date.now() };
    if (gate.action === "go" && gate.dest) return { dest: gate.dest, action: "go" };
    return { dest: null, action: "hold" };
  } catch { return { dest: null, action: "hold" }; }
}
function placeSpawnDest(dim, ownerLoc, want) {
  const cands = [];
  const push = (v) => { if (v && !cands.some((c) => c.x === v.x && c.y === v.y && c.z === v.z)) cands.push(v); };
  push(safeSpotNear(dim, want)); push(want); push(ownerLoc ? { ...ownerLoc } : null);
  for (const c of cands) { const g = placeGateDest(dim, ownerLoc, c); if (g.dest) return g.dest; }
  return null; // cycle0922 FC-13: 全候補 hold なら無検査の主人位置へ spawn せず見送る (呼び出し側が再試行する)
}
// 通り道の邪魔になっている自然のブロックを壊す。人工物・入れ物・岩盤・人工物の隣は壊さない (プレイヤーの建物を守る)
function pathBlockDrop(id) {
  if (/_leaves$/.test(id) || /^minecraft:(short_grass|tall_grass|fern|large_fern|vine|snow_layer|dead_bush)$/.test(id)) return null;
  for (const [re, item, n] of ORE_DROPS) if (re.test(id)) return [item, n];
  if (id === "minecraft:grass_block" || id === "minecraft:mycelium" || id === "minecraft:podzol" || id === "minecraft:dirt_path") return ["minecraft:dirt", 1];
  if (id === "minecraft:stone") return ["minecraft:cobblestone", 1];
  if (id === "minecraft:deepslate") return ["minecraft:cobbled_deepslate", 1];
  return [id, 1];
}
function canBreakForPath(bot, c, b) {
  const id = b.typeId;
  if (id === "minecraft:air" || b.isLiquid || id === "minecraft:bedrock" || id.includes("lava")) return false;
  if (isArtificialId(id) || isContainerBlock(id)) return false;
  if (structureGuard(bot.dimension, c)) return false;
  if (requiredPickLevel(id) > bestPickLevel(bot)) return false;
  if (lavaNear(bot.dimension, c)) return false;
  return true;
}
function breakForPath(bot, r, c, opts = {}) {
  let b = null; try { b = bot.dimension.getBlock(c); } catch {}
  if (!b || !canBreakForPath(bot, c, b)) return false;
  // forbids 直前ゲート (cyc2003 A17-D2): 経路掘り・救済・坑道の即時破壊も tickWork と同じ
  // 純粋核で fail-closed に照合する (従来は canBreakForPath と到達ゲートだけで素通りしていた)。
  try {
    let fbBlocked = false;
    try { fbBlocked = isForbiddenWorkTarget(r.sessionForbids, b.typeId, dropOfWorkTarget) === true; } catch { fbBlocked = true; }
    if (fbBlocked) { try { r.lastBreak = { act: "BREAK", ok: false, reason: "FORBIDDEN", item: b.typeId, at: Date.now() }; commitLastAction(r, r.lastBreak); } catch {} return false; }
  } catch { return false; }
  // 要望バッチA (v0.4.88): 経路掘り・救済・坑道 dig にも到達ゲートを通す。dig_first は遮蔽側を深さ1だけ先に掘る
  try {
    const eye2 = { x: bot.location.x, y: bot.location.y + 1.6, z: bot.location.z };
    const g2 = evaluateDig(digBlockAt(bot), eye2, c, { reach: WORK_REACH, feetCell: { x: Math.floor(bot.location.x), y: Math.floor(bot.location.y), z: Math.floor(bot.location.z) }, via: opts.via || "path" });
    if (g2.action === "hold") { try { r.lastDigHold = { why: g2.why, loc: { ...c }, at: Date.now() }; } catch {} return false; }
    if (g2.action === "dig_first") { if ((opts._depth || 0) >= 1) return false; return breakForPath(bot, r, g2.cell, { via: opts.via || "path", _depth: (opts._depth || 0) + 1 }); }
  } catch { try { r.lastDigHold = { why: "gate_error", loc: { ...c }, at: Date.now() }; } catch {} return false; } // 要望バッチA GAP-2 (cycle0821): ゲート例外時は fail-closed (掘らずに false)
  const id = b.typeId;
  try { b.setType("minecraft:air"); } catch (err) { noteFail(bot, "path:break_failed", err); return false; }
  try { sfxDigBreak(bot.dimension, { x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5 }, id); } catch {} // cycle1807 (lize-sound DESIGN §6.2 #3): 経路掘り・救済・坑道の破壊音 (tickWork とは排他経路のため二重音なし・実機確認待ち)
  const drop = pathBlockDrop(id);
  if (drop) { try { const cont = invOf(bot); const rest = cont ? cont.addItem(new ItemStack(drop[0], drop[1])) : new ItemStack(drop[0], drop[1]); if (rest) bot.dimension.spawnItem(rest, bot.location); } catch {} }
  try { r.lastBreak = { act: "BREAK", ok: true, reason: "PATH", item: id, gained: drop ? drop[1] : 0, at: Date.now() }; commitLastAction(r, r.lastBreak); } catch {}
  return true;
}
const PATH_DIG_TICKS = (id) => /_leaves$|grass|snow|vine|fern/.test(id) ? 1 : /dirt|sand|gravel|clay|mud|podzol|mycelium/.test(id) ? 2 : /deepslate|obsidian/.test(id) ? 6 : 4; // 移動ループ (2tick) 何回ぶんで壊すか
// v0.4.69: 移動先の足元が固いブロックなら、その上面まで持ち上げる。持ち上げても体・目が入らないなら null (移動しない)。
// 地上の経路移動は区間の高さを直線で補間するため、1 段上がる時に後半ずっと下半身がブロックに入ったまま滑っていた
function liftFeet(dim, dest) {
  let y = dest.y;
  const bx = Math.floor(dest.x), bz = Math.floor(dest.z);
  for (let k = 0; k < 2; k++) { const fy = Math.floor(y); if (solidAt(dim, { x: bx, y: fy, z: bz })) y = fy + 1; else break; }
  for (const c of bodyCells({ x: dest.x, y, z: dest.z })) if (solidAt(dim, c)) return null;
  return { ...dest, y };
}
// 埋まっていたら脱出する: 自然のブロックなら掘って消す。壊せないもの (人工物・岩盤) なら近くの空いた場所へ移る
// 窒息救済V2 (キュー5, basics-suffocate DESIGN): 落下ブロック埋没/再充填の兆候では掘るより先に横へ逃げる
const FALLING_BLOCK_IDS = new Set(["minecraft:sand","minecraft:red_sand","minecraft:suspicious_sand","minecraft:gravel","minecraft:suspicious_gravel","minecraft:white_concrete_powder","minecraft:orange_concrete_powder","minecraft:magenta_concrete_powder","minecraft:light_blue_concrete_powder","minecraft:yellow_concrete_powder","minecraft:lime_concrete_powder","minecraft:pink_concrete_powder","minecraft:gray_concrete_powder","minecraft:light_gray_concrete_powder","minecraft:cyan_concrete_powder","minecraft:purple_concrete_powder","minecraft:blue_concrete_powder","minecraft:brown_concrete_powder","minecraft:green_concrete_powder","minecraft:red_concrete_powder","minecraft:black_concrete_powder"]);
function safeSpotWide(dim, loc) {
  const bx = Math.floor(loc.x), by = Math.floor(loc.y), bz = Math.floor(loc.z);
  const cellSafe = (x, y, z) => { try { const b = dim.getBlock({ x, y, z }); if (!b) return false; if (solidOfTypeId(b.typeId) && !b.isLiquid) return false; if (b.typeId.includes("lava")) return false; if (/fire|cactus|sweet_berry|powder_snow/.test(b.typeId)) return false; return true; } catch { return false; } };
  const spotOk = (x, y, z) => {
    for (const c of bodyCells({ x: x + 0.5, y, z: z + 0.5 })) if (!cellSafe(c.x, c.y, c.z)) return false;
    try { const above = dim.getBlock({ x, y: Math.floor(y + 1.62) + 1, z }); if (above && FALLING_BLOCK_IDS.has(above.typeId)) return false; } catch { return false; }
    return true;
  };
  const dys = [0, 1, -1, 2, -2, 3, 4, 5, 6, 7, 8];
  for (const dy of dys) for (let ring = 1; ring <= 4; ring++) for (let dx = -ring; dx <= ring; dx++) for (let dz = -ring; dz <= ring; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
    const x = bx + dx, y = by + dy, z = bz + dz;
    if (spotOk(x, y, z)) return { x: x + 0.5, y, z: z + 0.5 };
  }
  return null;
}
function selfRescue(bot, r) {
  const dim = bot.dimension;
  const stuck = bodyCells(bot.location).filter((c) => solidAt(dim, c));
  if (!stuck.length) {
    // キュー4 R4-1 (cycle1518-a01): crown (足+2・teleport_gate Tier2 と同一定義) 単独の塞がりは bodyCells (足・胴・目) に含まれず盲点だった。応答は葉限定・掘削のみ・移転なし。別の移動 tick でも同じセルが残る場合だけ掘り (r.crownSeen)、一過性の重なりでは発動しない。カウンタは rescueCount と分ける
    try {
      const crownCell = { x: Math.floor(bot.location.x), y: Math.floor(bot.location.y) + 2, z: Math.floor(bot.location.z) };
      let cb = null; try { cb = dim.getBlock(crownCell); } catch {}
      if (cb && /_leaves$/.test(cb.typeId) && solidAt(dim, crownCell)) {
        const key = `${crownCell.x},${crownCell.y},${crownCell.z}`;
        if (r.crownSeen === key) { if (breakForPath(bot, r, crownCell, { via: "rescue" })) { r.crownClearCount = (r.crownClearCount || 0) + 1; r.crownSeen = null; } }
        else r.crownSeen = key;
      } else r.crownSeen = null;
    } catch {}
    r.rescueNoSpot = null; r.rescueBackoffUntil = 0; if (r._rsqBroken) { const now = tick; for (const [k, t] of r._rsqBroken) if (now - t > 8) r._rsqBroken.delete(k); } return false; }
  // 基礎 rescue:no_spot 無出口是正 (cycle1421, a03実測): 脱出不能が続く間は試行を5秒に1回へ間引き、API消費と失敗記録の氾濫を止める (出口は下の exhausted 遷移)
  if (r.rescueBackoffUntil && Date.now() < r.rescueBackoffUntil && r._rescueLastTry && Date.now() - r._rescueLastTry < 5000) return true;
  r._rescueLastTry = Date.now();
  if (!r._rsqBroken) r._rsqBroken = new Map();
  const now = tick;
  const isColumnRisk = stuck.some((c) => { let b = null; try { b = dim.getBlock(c); } catch {} if (b && FALLING_BLOCK_IDS.has(b.typeId)) return true; const last = r._rsqBroken.get(`${c.x},${c.y},${c.z}`); return last !== undefined && now - last <= 8; });
  const relocate = () => { const spot = safeSpotWide(dim, bot.location) || safeSpotNear(dim, bot.location, { upFirst: true }); if (!spot) return false; const g = placeGateDest(dim, bot.location, spot); if (!g.dest) return false; try { bot.teleport(g.dest); } catch { return false; } r.rescueCount = (r.rescueCount || 0) + 1; r.lastRescue = { via: "wide", at: now }; return true; }; // キュー4 R4-2 (cycle1518-a01): 移転先を place モード (crown hard) の共通ゲートへ通す。従来は無検査で crown の塞がった場所へ入れた。teleport 例外時は成功扱いせず掘削/no_spot 経路へ落とす
  if (isColumnRisk && relocate()) { r.rescueNoSpot = null; r.rescueBackoffUntil = 0; return true; }
  let freed = true;
  for (const c of stuck) { if (!breakForPath(bot, r, c, { via: "rescue" })) { freed = false; break; } r._rsqBroken.set(`${c.x},${c.y},${c.z}`, now); }
  if (!freed) {
    if (!relocate()) {
      noteFail(bot, "rescue:no_spot", new Error(JSON.stringify(stuck[0])));
      // 基礎 rescue:no_spot 無出口是正 (cycle1421): 従来は記録だけで状態が進まず2tickごとに無制限に再突入していた。
      // 30秒継続で exhausted へ遷移し、主人へ1回だけ知らせて120秒のバックオフへ入る (branchmine exhausted の作法)
      const nowMs = Date.now();
      if (!r.rescueNoSpot) r.rescueNoSpot = { since: nowMs, noted: false };
      if (nowMs - r.rescueNoSpot.since >= 30000 && !r.rescueNoSpot.noted) {
        r.rescueNoSpot.noted = true; r.rescueBackoffUntil = nowMs + 120000;
        noteFail(bot, "rescue:no_spot_exhausted", new Error(JSON.stringify(stuck[0])));
        try { const ow = getPlayer(dp(bot, "cb_owner", "")); if (ow) say(ow, bot, "埋まってしまい、自分では脱出できません。周囲を空けてください", true); } catch {}
      } else if (r.rescueNoSpot.noted && nowMs >= (r.rescueBackoffUntil || 0)) {
        // 到達可能性監査是正 (cycle0403-a06 実測): 従来は再武装条件が !noted に閉じ、バックオフ失効後は間引きも再通知も二度と起きない無出口だった。失効後も埋没が続くなら周期的に再通知+再バックオフする
        r.rescueNoSpot.cycles = (r.rescueNoSpot.cycles || 0) + 1; r.rescueBackoffUntil = nowMs + 120000;
        noteFail(bot, "rescue:no_spot_exhausted", new Error(JSON.stringify(stuck[0])));
        try { const ow = getPlayer(dp(bot, "cb_owner", "")); if (ow) say(ow, bot, "埋まってしまい、自分では脱出できません。周囲を空けてください", true); } catch {}
      }
    }
    return true;
  }
  r.rescueNoSpot = null; r.rescueBackoffUntil = 0;
  r.rescueCount = (r.rescueCount || 0) + 1;
  return true;
}
// 指示の実行中、進む先が自然のブロックで塞がっていて進めないなら、それを掘って進む
function clearPathAhead(bot, r, blocked) {
  if (!blocked || !r.target) return;
  const workAct = typeof r.moveAct === "string" && (r.moveAct.startsWith("pickup_") || r.moveAct.startsWith("deliver") || r.moveAct === "deposit" || r.moveAct === "chest_alert"); // S1 (cycle2036): syncFlyGoal の interact 判定と許可集合を一致させる (回収/納品/入庫でも掘進救済が届くように)
  if (!((r.mission && r.mission.status === "active") || r.longtask || (r.buildPlan && r.buildPlan.stage === "build") || workAct)) { r.clearDig = null; return; } // 追従中はプレイヤーの周りを掘らない // BLD-06 (cycle1133): 建築中も掘進できるよう build 段階を許可 (掘否は canBreakForPath+dig_gate が担う)
  const p = bot.location, t = r.target;
  const dx = t.x - p.x, dz = t.z - p.z, dy = t.y - p.y, hd = Math.hypot(dx, dz);
  if (Math.hypot(hd, dy) < 1.5) return;
  if (r.tunnelPath && r.tunnelPath.length && Math.hypot(hd, dy) > 6) return; // 地下から遠くへ行く時は、横に掘り進まずに掘ってきた道で地上へ戻る
  const cand = [];
  if (hd > 0.6) {
    const nx = Math.floor(p.x + (dx / hd) * 0.9), nz = Math.floor(p.z + (dz / hd) * 0.9);
    if (nx !== Math.floor(p.x) || nz !== Math.floor(p.z)) for (const c of bodyCells({ x: nx + 0.5, y: p.y + Math.max(-1, Math.min(1, dy)) * 0.35, z: nz + 0.5 })) cand.push(c);
  }
  if (dy < -1 && hd < 1.5) cand.push({ x: Math.floor(p.x), y: Math.floor(p.y) - 1, z: Math.floor(p.z) });   // 真下へ
  if (dy > 1 && hd < 1.5) cand.push({ x: Math.floor(p.x), y: Math.floor(p.y + 1.62) + 1, z: Math.floor(p.z) }); // 真上へ
  const dim = bot.dimension;
  for (const c of cand) {
    let b = null; try { b = dim.getBlock(c); } catch {}
    if (!b || !solidOfTypeId(b.typeId) || b.isLiquid) continue;
    if (!canBreakForPath(bot, c, b)) { r.clearDig = null; return; } // 壊してはいけない物: 掘らずに既存の回避・見切りに任せる
    const key = `${c.x},${c.y},${c.z}`;
    if (!r.clearDig || r.clearDig.key !== key) r.clearDig = { key, left: PATH_DIG_TICKS(b.typeId) };
    if (--r.clearDig.left <= 0) { breakForPath(bot, r, c, { via: "path" }); r.clearDig = null; r.stuckSec = 0; }
    return;
  }
}
// v0.4.70: 体 (模擬プレイヤー) の管理
const bodies = createBodyManager(mcGametest, mcServer, { noteFail: (bot, where, err) => noteFail(bot, where, err) });
if (BODY_SIM_ENABLE && !bodies.available) console.warn("[LIZE] simulated player body unavailable (Beta APIs off?) - using legacy movement");
// ---------- メインループ ----------
system.runInterval(() => {
  tick++;
  // 移動（2tickごと）: 既定はホバー飛行（fly）。fly が ground を返した時だけ nav/direct。
  for (const [id, r] of bots) {
    let bot = null; try { bot = world.getEntity(id); } catch {}
    if (!bot) { try { if (r.wmem && r.wmem.dirty) r.wmem.save(); } catch {} try { bodies.release(r); } catch {} bots.delete(id); continue; } // v0.4.56 (外部レビュー指摘5): 消去前に未保存の世界記憶を書く
    // v0.4.70: 体 (模擬プレイヤー) で歩ける間は体に任せる。任せられない間 (水・崖越え・地下など) は従来の移動の後、体を追従させる
    let bodyMode = "legacy";
    if (BODY_SIM_ENABLE && bodies.available) { try { bodyMode = bodies.tick(bot, r, { container: invOf(bot) }); } catch (err) { noteFail(bot, "body:tick", err); } }
    if (bodyMode === "body") { r.flyMode = "body"; r.stuckSec = 0; continue; }
    try { selfRescue(bot, r); } catch {} // v0.4.68: 埋まっていたら脱出 (窒息防止)。移動ループ (2tick) ごとに見る
    // 作り込み POLISH-SND-SWIM-01 (cycle0731): 入水/出水の遷移でのみ水音を鳴らす (sfxSplash 実配線、表示層のみ・実機確認待ち)
    try { const inW = !!bot.isInWater; if (r._wasInWater !== undefined && inW !== r._wasInWater) { try { sfxSplash(bot.dimension, bot.location); } catch {} } r._wasInWater = inW; } catch {}
    // 作り込み POLISH-SND-STEP-01 (v0.4.89): 移動中の足音を足元素材で鳴らす (sfxStep 実配線、350ms間引き、表示層のみ)
    try { const lp = r._stepSfxPos; const cp = bot.location; if (lp && Math.hypot(cp.x - lp.x, cp.z - lp.z) >= 0.4) { const nowMs = Date.now(); if (!r._stepSfxAt || nowMs - r._stepSfxAt >= 350) { const below = bot.dimension.getBlock({ x: Math.floor(cp.x), y: Math.floor(cp.y - 0.5), z: Math.floor(cp.z) }); if (below && solidOfTypeId(below.typeId)) { if (sfxStep(bot.dimension, { x: cp.x, y: cp.y, z: cp.z }, below.typeId, { medium: !!bot.isInWater ? "water" : null })) r._stepSfxAt = nowMs; } } } r._stepSfxPos = { x: cp.x, y: cp.y, z: cp.z }; } catch {} // POLISH-SND-ENV-01 (cycle1234): 水中では足音を鈍くする (medium は SWIM-01 で既読の isInWater 由来、追加の API 呼び出しなし、表示層のみ・実機確認待ち)
    // 作り込み POLISH-SND-HURT-01 (cycle0942): 被弾音の実配線。sfxHurt は定義済みだが未配線だった。HP低下の辺でのみ鳴らす (表示層のみ・実機確認待ち)
    try { if (!r.sfxState) r.sfxState = createSfxState(); const hpNow = hpOf(bot); if (typeof r._sfxPrevHp === "number" && hpNow.cur < r._sfxPrevHp - 0.01) { try { sfxHurt(r.sfxState, bot.dimension, bot.location, Date.now()); } catch {} } r._sfxPrevHp = hpNow.cur; } catch {}
    // 作り込み POLISH-SND-LAND-01 (cycle0942): 着地音の実配線。sfxLand は定義済みだが未配線だった。selfFalling (supplySelfFalling) の真→偽の辺で、落下距離2以上なら足元素材の step 音を強めに鳴らす (表示層のみ・実機確認待ち)
    // 作り込み POLISH-FX-ENVRESIDUE-01 (cycle0942): 環境残留表現の状態機械を配線。出水/粉雪脱出の辺から減衰プロファイルで残留を出す。パーティクルIDは未照合 (profile の particleId=null) のため現時点では r.lastResidue への記録のみで、照合済みIDが入った媒体から実表示が始まる (虚偽の見た目を作らない)。表示層のみ・実機確認待ち
    try { const insideRes = bot.isInWater ? "water" : ((r.lastCtx && r.lastCtx.x && r.lastCtx.x.selfFreezing) ? "powder_snow" : null); if (!r.residueState) r.residueState = createResidueState(); const rtRes = residueTick(r.residueState, insideRes, Date.now()); r.residueState = rtRes.state; if (rtRes.emit) { r.lastResidue = { medium: rtRes.medium, particle: rtRes.particleId, at: Date.now() }; if (rtRes.particleId) { try { emitResidueParticle(bot.dimension, bot.location, rtRes.medium); } catch {} } } } catch {}
    try { if (!r.breathColdState) r.breathColdState = { lastFiredAtMs: null, nextDueAtMs: null, coldSinceMs: null, fireCount: 0, wasEligible: false }; const bx = r.lastCtx?.x; const firedB = noteBreathCold(r.breathColdState, { cold: bx?.biome === "snow", inPowderSnow: bx?.selfFreezing === true, inWater: !!bot.isInWater, dimension: (() => { try { return bot.dimension.id; } catch { return null; } })(), danger: !!((r.lastCtx?.danger?.count ?? 0) > 0), falling: r.selfFalling === true, nowMs: Date.now() }); if (firedB) r.lastBreathCold = { at: Date.now(), count: r.breathColdState.fireCount }; } catch {} // POLISH-FX-BREATHCOLD-01 (cycle1343): 寒冷地で約4秒周期に発火を記録のみ (粒子ID未照合のため spawnParticle は呼ばない、ENVRESIDUE と同方式・実機確認待ち)
    try { const fallingNow = !!(r.lastCtx && r.lastCtx.x && r.lastCtx.x.selfFalling); if (fallingNow) { if (typeof r.selfFallPeakY === "number") r._landPeakY = r.selfFallPeakY; } else if (r._landFalling) { const peak = (typeof r._landPeakY === "number") ? r._landPeakY : bot.location.y; if (peak - bot.location.y >= 2) { const below2 = bot.dimension.getBlock({ x: Math.floor(bot.location.x), y: Math.floor(bot.location.y - 0.5), z: Math.floor(bot.location.z) }); if (below2 && solidOfTypeId(below2.typeId)) { try { sfxLand(bot.dimension, bot.location, below2.typeId); } catch {} } } r._landPeakY = null; } r._landFalling = fallingNow; } catch {}
    if (!r.target) { try { noteMove(bot, r, "idle"); } catch {} if (r.body) bodies.followBot(bot, r); continue; }
    const pos0 = bot.location;
    // --- 飛行を先に試す ---
    let fres = null;
    if (FLY_ENABLE) { try { fres = flyTick(flyOf(bot, r), pos0, 0.1, { ownerPos: r.ownerPosCache || null }); } catch (err) { try { recordMoveExp(r, { ok: false, reason: "API_ERROR" }, "fly"); } catch {} noteFail(bot, "flyTick", err, { expDone: true }); } } // 6-ML U4: 例外は MOVE 失敗として commit 済みのため fail軸 EXP は二重記録回避
    if (fres) { const fr = fres.reason || ""; if (fr && fr !== r.lastFlyReason) r.flyReasonCount = (r.flyReasonCount || 0) + 1; if (fr) r.lastFlyReason = fr; if (fres.arrived) { r.flyArrivedAt = Date.now(); try { recordMoveExp(r, { ok: true }, "fly"); } catch {} } } // Phase2: fly理由の回収（追加のみ・挙動不変） // 6-ML U4: 到着は MOVE 成功として記録
    if (fres && fres.mode === "fly") {
      if (fres.move) { try { bot.teleport(fres.move, { rotation: { x: 0, y: fres.move.yaw } }); } catch {} }
      else { try { clearPathAhead(bot, r, ["dest_blocked", "flight_blocked", "no_progress"].includes(fres.reason) || r.stuckSec >= 1); } catch {} } if (fres.move && r.stuckSec >= 1) { try { clearPathAhead(bot, r, true); } catch {} } // queue0-A bug1 (cycle1728): hover move issued but stuck -> still try digging rescue // v0.4.68: 塞がれて動けない時は掘って進む
      const t = r.target; const td = Math.hypot(t.x - pos0.x, t.y - pos0.y, t.z - pos0.z);
      if (r.lastPos && Math.hypot(pos0.x - r.lastPos.x, pos0.y - r.lastPos.y, pos0.z - r.lastPos.z) < 0.05 && td > 2) r.stuckSec += 0.1; else r.stuckSec = 0;
      r.lastPos = { ...pos0 };
      r.flyMode = "fly";
      movementWatchdog(bot, r, pos0);
      try { noteMove(bot, r, "fly"); } catch {}
      if (r.body) bodies.followBot(bot, r); // v0.4.70
      continue;
    }
    if (r.flyMode === "fly") { try { navClearGoal(navOf(bot, r)); } catch {} } // fly→ground 切替時は nav の古い目標を捨てる
    r.flyMode = "ground";
    let res = null;
    try { res = navTick(navOf(bot, r), bot.location, 0.1, { act: r.moveAct }); } catch { try { recordMoveExp(r, { ok: false, reason: "API_ERROR" }, "nav"); } catch {} } // 6-ML U4: 従来無言だった例外を MOVE 失敗として記録のみ
    r.navMode = res?.mode || "direct";
    if (res && res.arrived) { try { recordMoveExp(r, { ok: true }, res.mode === "path" ? "nav" : "direct"); } catch {} } // 6-ML U4: nav 到着は MOVE 成功として記録
    if (res && res.mode === "path" && res.move) {
      const p0 = bot.location;
      const lifted = liftFeet(bot.dimension, { x: res.move.x, y: res.move.y, z: res.move.z }); // v0.4.69: 段差で下半身が埋まらない
      if (lifted) { try { bot.teleport(lifted, { rotation: { x: 0, y: res.move.yaw } }); } catch {} } else { try { navClearGoal(navOf(bot, r)); } catch {} } // 体が入らないなら動かず経路を引き直す
      const t = r.target; const hd = Math.hypot(t.x - p0.x, t.z - p0.z);
      if (r.lastPos && Math.hypot(p0.x - r.lastPos.x, p0.z - r.lastPos.z) < 0.05 && (typeof t.y === "number" ? Math.hypot(p0.x - t.x, p0.y - t.y, p0.z - t.z) : hd) > 2) r.stuckSec += 0.1; else r.stuckSec = 0; // queue0-A bug1 (cycle1728): 3D distance
      r.lastPos = { ...p0 };
    } else {
      moveDirect(bot, r);
    }
    if (res) applyDoors(bot, res, r);
    try { clearPathAhead(bot, r, r.stuckSec >= 1); } catch {} // v0.4.68: 地上移動でも塞がれていたら掘って進む
    movementWatchdog(bot, r, pos0);
    try { noteMove(bot, r, r.navMode === "path" ? "nav" : "direct"); } catch {}
    if (r.body) bodies.followBot(bot, r); // v0.4.70
  }
}, 2);

// ---------- v0.3.0: 指示ミッション / 建築 / 工場 / 視線 ----------
const LIFE_CRITICAL_ACTS = new Set(["flee", "rest_at_home", "use_heal_item", "place_block_escape"]); // ENV-02 (cycle0340): 溶岩浸漬は生命危機のため足場脱出も割り込み対象 // ミッション中の安全割り込みはこの集合に限る（挙動ベンチ弱点2。use_heal_item は装備文脈でのみ発火する自己回復で、ベンチ文脈では出現しない）
function missionSig(m) { // Phase 0 負荷対策: 復元に必要な構造だけの軽量シグネチャ（obsCount/updatedAt/have は再導出できるので含めない）
  if (!m) return "";
  const steps = (m.steps || []).map((s) => `${s.status}:${s.banked || 0}:${s.base == null ? 0 : 1}:${s.searchStage || 0}`).join(",");
  // cycle1832 S-2/S-3: 見切りカウンタ群は生値でなく量子バケット (上限の約1/10) で sig へ含める。
  // 復元跨ぎの喪失を上限の約10%以下に有界化しつつ、毎観測の DP 書き (dirty 化の目的) は増やさない。
  const qb = (v, q) => Math.floor((v || 0) / q);
  const qSteps = (m.steps || []).map((s) => `${qb(s.stallObs, 6)},${qb(s.foundStallObs, 60)},${qb(s.routeFrozenObs, 190)},${qb(s.wdFrozenObs, 190)},${qb(s.searchFrozenObs, 190)},${qb(s.regionFrozenObs, 190)},${qb(s.regionTotalObs, 2000)}`).join(";");
  const qDetour = m.detour ? `${qb(m.detour.stallObs, 6)},${qb(m.detour.routeFrozenObs, 190)}` : "";
  return `${m.status}|${m.currentStep}|${m.suspendReason || ""}|${m.suspendCount || 0}|${m.suspendWaitSince || 0}|${m.detour ? m.detour.phase + ":" + m.detour.resumeStep : ""}|${steps}|q:${qb(m.recoverObs, 60)}:${qb(m.invUnreadObs, 60)}:${m.blocked ? 1 : 0}:${qSteps}:${qDetour}`; // cycle1807: suspendWaitSince を sig へ含める (cannot_recover の180秒上限が復元をまたいで到達可能になる)
}
function persistMission(bot, r, force = false) {
  const sig = missionSig(r.mission);
  if (!force && sig === r.missionSig) return; // 復元に効く変化なし → DP書きを省略
  r.missionSig = sig;
  dps(bot, "cb_mission", r.mission ? JSON.stringify(r.mission) : "");
}
// ENDGOAL W-A (cyc2363): shadow 状態の永続化 (persistMission と同形の sig dirty 方式)。
// 開始済み状態を pre_start として保存しない (st.phase が pre_start の未開始は保存対象外)。
function persistEndgoal(bot, r, force = false) {
  try {
    const eg = r.endgoal;
    if (!eg || !eg.st || eg.st.phase === "pre_start") return;
    const sig = [eg.st.phase, eg.st.failed || "", (eg.milestones || []).join(","), eg.endReason || ""].join("|");
    if (!force && sig === r.endgoalSig) return;
    r.endgoalSig = sig;
    dps(bot, "cb_endgoal", JSON.stringify({ st: eg.st, milestones: eg.milestones || [], phaseSince: eg.phaseSince || 0, endReason: eg.endReason || null }));
  } catch {}
}
// ENDGOAL W-A F5: 節目ログの単一出口。発出済み集合 (永続化) で二重発出を防ぐ。
function emitEndgoalMilestone(bot, r, name, reason) {
  try {
    const eg = r.endgoal; if (!eg) return;
    if (!eg.milestones) eg.milestones = [];
    if (name) {
      if (eg.milestones.includes(name)) return;
      eg.milestones.push(name);
      console.warn(`[LIZE] ENDGOAL 節目: ${name}`);
    } else if (reason) {
      if (eg.endReason) return;
      eg.endReason = reason;
      console.warn(`[LIZE] ENDGOAL 終了: ${reason}`);
    }
    persistEndgoal(bot, r);
  } catch {}
}
// ENDGOAL W-A F3: feeder 本体。次元読み取り例外の tick は obs を作らず null (B4 ガード)。
// crystalsAlive/dragonAlive は段階1実行中のみ広域走査し、未確定なら null (0 と断定しない)。
function buildEndgoalObs(bot, r) {
  let dimId = null; try { dimId = bot.dimension.id; } catch { return null; }
  const phase = r.endgoal?.st?.phase || "pre_start";
  const inEnd = dimId === "minecraft:the_end";
  let crystalsAlive = null, dragonAlive = null;
  if (inEnd && phase !== "pre_start" && phase !== "done") {
    try { let c = 0, d = false; for (const e of bot.dimension.getEntities({ location: bot.location, maxDistance: 96 })) { if (e.typeId === "minecraft:end_crystal") c++; else if (e.typeId === "minecraft:ender_dragon") d = true; } crystalsAlive = c; dragonAlive = d; } catch { crystalsAlive = null; dragonAlive = null; }
  }
  let hpRatio = null; try { const h = hpOfMeasured(bot); if (h && h.max > 0) hpRatio = h.cur / h.max; } catch {}
  let portalSeen = false;
  if (phase === "seek_return_portal") { try { const pk = scanCachePeek(r, "minecraft:end_portal"); portalSeen = pk?.state === "hit" && !!pk.loc; } catch { portalSeen = false; } }
  return { inEnd, crystalsAlive, dragonAlive, dragonPerched: false, hasRanged: false, hpRatio, portalSeen,
    returned: phase === "seek_return_portal" && dimId === "minecraft:overworld" }; // B4 厳密定義: 現在相 seek_return_portal かつ overworld のときだけ true
}
// ENDGOAL W-A F4: shadow 駆動。核の action は実行へ渡さず r.endgoal.lastAction へ記録するだけ。
function tickEndgoalShadow(bot, r, ctxOrNull) {
  try {
    const eg = r.endgoal; if (!eg || !eg.st) return;
    if (eg.st.phase === "done" || eg.st.failed || eg.endReason) return;
    const obs = buildEndgoalObs(bot, r); if (!obs) return;
    // 開始辺ガード: pre_start ではエンド内観測のときだけ核へ通す (核は pre_start+非エンドで即 LEFT_END_EARLY 粘着失敗になるため)
    if (eg.st.phase === "pre_start" && obs.inEnd !== true) return;
    // B3 ガード: 現在相の必須観測が null (UNKNOWN) の間は核を呼ばない
    if (eg.st.phase === "seek_crystals" && typeof obs.crystalsAlive !== "number") return;
    if (eg.st.phase === "dragon_fight" && typeof obs.dragonAlive !== "boolean") return;
    const before = eg.st.phase;
    const out = stepEndgoal(eg.st, obs);
    eg.st = out.state;
    eg.lastAction = out.action || null;
    if (eg.st.phase !== before) eg.phaseSince = Date.now();
    if (out.milestone) emitEndgoalMilestone(bot, r, out.milestone, null);
    if (eg.st.failed) emitEndgoalMilestone(bot, r, null, eg.st.failed);
    persistEndgoal(bot, r);
  } catch {}
}
function countInv(e) { const out = Object.create(null); const cont = invOf(e); if (cont) for (let i = 0; i < cont.size; i++) { const it = cont.getItem(i); if (it) out[it.typeId] = (out[it.typeId] || 0) + it.amount; } return out; }
function invDurabilityOf(e) { const cont = invOf(e); return cont ? collectInvDurability(cont) : {}; } // cycle2311: planBootstrap の invDurability 入力の供給者
function hasItem(bot, typeId) { return (countInv(bot)[typeId] || 0) > 0; }
function returnPoint(bot, owner, m) {
  if (m.order.returnTo === "home") { const h = homeOf(bot); if (h && h.dim === bot.dimension.id) return { x: h.x + 0.5, y: h.y + 1, z: h.z + 0.5 }; }
  return { ...owner.location };
}
function behindOf(owner, d) { const vd = (() => { try { return owner.getViewDirection(); } catch { return { x: 0, z: 1 }; } })(); const m = Math.hypot(vd.x, vd.z); const ux = m > 1e-4 ? vd.x / m : 0, uz = m > 1e-4 ? vd.z / m : 1; return { x: owner.location.x - ux * d, y: owner.location.y, z: owner.location.z - uz * d }; } // FW-01 (cycle0537): execTarget の behind と同じ水平正規化
const SCAN_TTL_MS = 4000;         // Phase 0 負荷対策: 型別キャッシュの保持時間 (v0.4.66: 広域化に合わせ 2.5→4 秒)
// v0.4.66: 広域ブロック探索。dimension.getBlocks (ネイティブ) で一致ブロックの位置だけを受け取る。
// 近い範囲から順に広げ (8→16→32)、最初に見つかった範囲で止める。石のような大量にある対象でも
// 反復数を抑えられる。getBlocks が使えない・例外の環境では従来の ±8 の 1 マス走査へ戻る。
const SCAN_RINGS = [{ h: 8, v: 4 }, { h: 16, v: 8 }, { h: 32, v: 12 }];
const SCAN_ITER_CAP = 4000; // 1 回の問い合わせで見る一致位置の上限
// v0.4.68: getBlocks 1 回あたりの体積上限 (fillBlocks と同じ 32768 に合わせる)。超える範囲は分けて問い合わせる
const QUERY_MAX_VOLUME = 32768;
function splitVolume(a, b) {
  const out = [], stack = [[a, b]];
  while (stack.length) {
    const [p, q] = stack.pop();
    const sx = q.x - p.x + 1, sy = q.y - p.y + 1, sz = q.z - p.z + 1;
    if (sx * sy * sz <= QUERY_MAX_VOLUME) { out.push([p, q]); continue; }
    if (sy >= sx && sy >= sz) { const m = p.y + Math.floor(sy / 2) - 1; stack.push([p, { ...q, y: m }], [{ ...p, y: m + 1 }, q]); }
    else if (sx >= sz) { const m = p.x + Math.floor(sx / 2) - 1; stack.push([p, { ...q, x: m }], [{ ...p, x: m + 1 }, q]); }
    else { const m = p.z + Math.floor(sz / 2) - 1; stack.push([p, { ...q, z: m }], [{ ...p, z: m + 1 }, q]); }
  }
  return out;
}
const warnedOnce = new Set();
function warnOnce(key, msg) { if (warnedOnce.has(key)) return; warnedOnce.add(key); console.warn(msg); }
const wideScanState = createWideScanFails(5); // 0-D4 Bprime: failures isolated per typeId; only infra failures are global
function wideQuery(bot, typeIds, skipFn = null) { // cyc2367 HARVEST-OCCLUDED-YOUNG-01: 任意 skip（既定 null で従来不変）
  // 戻り値: { ok, best: { typeId: {x,y,z}|null } }。ok=false は「測れなかった」(呼び出し側が従来走査へ)
  const best = {}; for (const id of typeIds) best[id] = null;
  const part1455 = partitionWideIds(wideScanState, typeIds); const typeIdsQ = part1455.usable;
  if (!typeIdsQ.length) return { ok: false, best };
  const BV = mcServer.BlockVolume;
  const dim = bot.dimension;
  if (!BV || typeof dim.getBlocks !== "function") { noteWideGlobalFailure(wideScanState); wideScanState.global = wideScanState.maxFails; return { ok: false, best }; }
  let minY = -64, maxY = 319; try { minY = dim.heightRange.min; maxY = dim.heightRange.max - 1; } catch {}
  const bx = Math.floor(bot.location.x), by = Math.floor(bot.location.y), bz = Math.floor(bot.location.z);
  const want = new Set(typeIdsQ);
  const bd = {};
  // 1 つの範囲・ID 群を問い合わせ、見つかった位置で best を更新する。例外はそのまま投げる
  const queryRing = (ring, ids) => {
    const y0 = Math.max(minY, by - ring.v), y1 = Math.min(maxY, by + ring.v);
    if (y0 > y1) return false;
    let n = 0, any = false;
    for (const [va, vb] of splitVolume({ x: bx - ring.h, y: y0, z: bz - ring.h }, { x: bx + ring.h, y: y1, z: bz + ring.h })) {
    const list = dim.getBlocks(new BV(va, vb), { includeTypes: ids }, true);
    for (const loc of list.getBlockLocationIterator()) {
      if (++n > SCAN_ITER_CAP) break;
      let id = ids.length === 1 ? ids[0] : null;
      if (!id) { try { id = dim.getBlock(loc)?.typeId ?? null; } catch { id = null; } }
      if (!id || !want.has(id)) continue;
      if (skipFn) { let sk = false; try { sk = !!skipFn(loc, id); } catch {} if (sk) continue; } // cyc2367: ban 中セルは次点へ譲る
      const dx = loc.x - bx, dy = loc.y - by, dz = loc.z - bz;
      const dd = dx * dx + dz * dz + dy * dy * 2.25; // 上下は 1.5 倍遠いとみなす (掘り進む手間)
      if (bd[id] === undefined || dd < bd[id]) { bd[id] = dd; best[id] = { x: loc.x, y: loc.y, z: loc.z }; any = true; }
    }
    if (n > SCAN_ITER_CAP) break;
    }
    return any;
  };
  let okAny = false, lastErr = null; const failedIds1455 = new Set();
  for (const ring of SCAN_RINGS) {
    let any = false;
    try { any = queryRing(ring, typeIdsQ); okAny = true; }
    catch (err) {
      lastErr = err;
      warnOnce("wide:" + String(err).slice(0, 60), `[LIZE] wide scan error (ring ${ring.h}): ${err}`);
      if (typeIdsQ.length > 1) for (const id of typeIdsQ) { try { if (queryRing(ring, [id])) any = true; okAny = true; } catch (e2) { lastErr = e2; failedIds1455.add(id); } }
      else failedIds1455.add(typeIdsQ[0]);
    }
    if (any) break;
  }
  if (okAny) { noteWideSuccess(wideScanState, typeIdsQ.filter((id) => !failedIds1455.has(id))); for (const id of failedIds1455) noteWideIdFailure(wideScanState, id); return { ok: true, best }; }
  for (const id of (failedIds1455.size ? [...failedIds1455] : typeIdsQ)) noteWideIdFailure(wideScanState, id);
  if (LIZE_DEBUG) console.warn(`[LIZE] wide scan failed (per-id): ${lastErr}`);
  return { ok: false, best };
}
// (旧 SCAN_SPECIES_PER_TICK は v0.4.64 で廃止: 樹種別分割走査が pending 固着の原因だったため一括走査へ)
function scanCachePeek(r, typeId) {
  const ent = r.mScanMap && r.mScanMap[typeId];
  if (!ent) return { state: "stale" };
  if (Date.now() - ent.at >= ent.ttl) return { state: "stale" };
  if (ent.loc) return { state: "hit", loc: ent.loc };
  // Phase2 INSPECT Step2: 失敗過半の走査は absent と偽らない (unknown)。旧形式エントリ (failedCells無し) で loc無しも unknown
  if (ent.failedCells === undefined || ent.failedCells * 2 > (ent.totalCells || 2601)) return { state: "unknown" };
  return { state: "absent" };
}
// cycle2231 収穫固着是正: 作物は成熟セルのみを走査候補にする (未成熟株の再選択ループ防止)。
// growth が読めない作物は安全側で候補にしない (crop_maturity の fail-closed と同一)。
function cropMatureAt(dim, loc, typeId) {
  if (!isCropBlock(typeId)) return true;
  try { const b = dim.getBlock(loc); let g = null; try { g = b?.permutation?.getState("growth") ?? b?.permutation?.getState("age"); } catch {} return isCropMature(typeId, g); } catch { return false; }
}
function cropCellMature(b, typeId) {
  if (!isCropBlock(typeId)) return true;
  let g = null; try { g = b?.permutation?.getState("growth") ?? b?.permutation?.getState("age"); } catch {}
  return isCropMature(typeId, g);
}
function scanBanned(r, loc, typeId, now) { // cyc2367 HARVEST-OCCLUDED-YOUNG-01: fail-open の ban 述語（例外時は ban されていない側へ倒す）
  try { if (isBanned(loc, typeId, r.mBanKey, r.mBanUntil, now)) return true; } catch {}
  try { if (r.workBan && isWorkBanned(r.workBan, loc, typeId, now)) return true; } catch {}
  return false;
}
function scanBlockNear(bot, r, typeId, ttlJitter = 0) {
  const pt = r.percTargets || {};
  const now0 = Date.now();
  for (const k of ["tree", "ore", "crop"]) if (pt[k] && pt[k].typeId === typeId && !scanBanned(r, pt[k], typeId, now0)) return { x: pt[k].x, y: pt[k].y, z: pt[k].z };
  const now = Date.now();
  if (!r.mScanMap) r.mScanMap = {};
  const ent = r.mScanMap[typeId];
  if (ent && now - ent.at < ent.ttl) { if (!ent.loc || !scanBanned(r, ent.loc, typeId, now)) return ent.loc; delete r.mScanMap[typeId]; }
  { const wq = wideQuery(bot, [typeId], (loc, id) => scanBanned(r, loc, id, now)); if (wq.ok && (!wq.best[typeId] || cropMatureAt(bot.dimension, wq.best[typeId], typeId))) { r.mScanMap[typeId] = { at: now, ttl: SCAN_TTL_MS + ttlJitter, loc: wq.best[typeId], failedCells: 0, totalCells: 2601 }; try { r.lastBlockScan = { typeId, failedCells: 0, totalCells: 2601, at: now, wide: true }; } catch {} return wq.best[typeId]; } } // v0.4.66: 広域探索
  let best = null, bd = 1e9, failedCells = 0;
  const bx = Math.floor(bot.location.x), by = Math.floor(bot.location.y), bz = Math.floor(bot.location.z);
  for (let dx = -8; dx <= 8; dx++) for (let dy = -4; dy <= 4; dy++) for (let dz = -8; dz <= 8; dz++) {
    let b = null; try { b = bot.dimension.getBlock({ x: bx + dx, y: by + dy, z: bz + dz }); } catch {}
    if (!b) { failedCells++; continue; } // Phase2 INSPECT Step0: 失敗セル計数 (例外と未読込を1セル1回だけ数える)
    if (b.typeId !== typeId) continue;
    if (!cropCellMature(b, typeId)) continue; // cycle2231: 未成熟作物は候補にしない
    if (scanBanned(r, b.location, typeId, now)) continue; // cyc2367: ban 中は次点へ譲る
    const dd = Math.hypot(dx, dy, dz); if (dd < bd) { bd = dd; best = { x: b.location.x, y: b.location.y, z: b.location.z }; }
  }
  r.mScanMap[typeId] = { at: now, ttl: SCAN_TTL_MS + ttlJitter, loc: best, failedCells, totalCells: 2601 };
  try { r.lastBlockScan = { typeId, failedCells, totalCells: 2601, at: now }; } catch {}
  return best;
}
// v0.4.64: 複数IDを1回の走査でまとめて確定させる。原木の樹種別分割走査 (1回2種まで) は
// TTL (2.5〜4.1秒) より一巡 (約5秒) が長く、常に未測定種が残って pending が解けなかった。
// 1走査で全ID分のキャッシュを同時に書くため、状態は必ず揃う。負荷は1種ぶんと同じ。
function scanBlocksNear(bot, r, typeIds) {
  const now = Date.now();
  if (!r.mScanMap) r.mScanMap = {};
  const want = new Set(typeIds); // cycle1722 A17偶然発見: 以前は wideQuery 側の局所名を写し間違えた未定義変数を参照し、呼ぶたび ReferenceError になっていた
  const best = {}, bd = {};
  for (const id of typeIds) { best[id] = null; bd[id] = Infinity; }
  const pt = r.percTargets || {};
  for (const k of ["tree", "ore", "crop"]) if (pt[k] && want.has(pt[k].typeId)) best[pt[k].typeId] = { x: pt[k].x, y: pt[k].y, z: pt[k].z };
  { const wq = wideQuery(bot, typeIds); if (wq.ok) { for (const id of typeIds) if (wq.best[id] && !cropMatureAt(bot.dimension, wq.best[id], id)) wq.best[id] = null; for (const id of typeIds) r.mScanMap[id] = { at: now, ttl: SCAN_TTL_MS, loc: best[id] || wq.best[id], failedCells: 0, totalCells: 2601 }; try { r.lastBlockScan = { typeId: typeIds[0], failedCells: 0, totalCells: 2601, at: now, wide: true }; } catch {} for (const id of typeIds) if (!best[id]) best[id] = wq.best[id]; return best; } } // v0.4.66: 広域探索
  let failedCells = 0;
  const bx = Math.floor(bot.location.x), by = Math.floor(bot.location.y), bz = Math.floor(bot.location.z);
  for (let dx = -8; dx <= 8; dx++) for (let dy = -4; dy <= 4; dy++) for (let dz = -8; dz <= 8; dz++) {
    let b = null; try { b = bot.dimension.getBlock({ x: bx + dx, y: by + dy, z: bz + dz }); } catch {}
    if (!b) { failedCells++; continue; }
    if (!want.has(b.typeId)) continue;
    if (!cropCellMature(b, b.typeId)) continue; // cycle2231: 未成熟作物は候補にしない
    const dd = dx * dx + dy * dy + dz * dz;
    if (dd < bd[b.typeId]) { bd[b.typeId] = dd; best[b.typeId] = { x: b.location.x, y: b.location.y, z: b.location.z }; }
  }
  for (const id of typeIds) r.mScanMap[id] = { at: now, ttl: SCAN_TTL_MS, loc: best[id], failedCells, totalCells: 2601 };
  try { r.lastBlockScan = { typeId: typeIds[0], failedCells, totalCells: 2601, at: now }; } catch {}
  return best;
}
// Phase2 INSPECT 実体 (v0.4.8): scanBlockNear の三状態ラッパ。結果は {state, source, confidence, loc} で返し r.lastInspect へ記録のみ
function inspectBlockNear(bot, r, typeId) {
  let out = null;
  try {
    const pt = r.percTargets || {};
    for (const k of ["tree", "ore", "crop"]) if (pt[k] && pt[k].typeId === typeId && bot?.dimension) { out = { state: "present", source: "perc", confidence: 0.9, loc: { x: pt[k].x, y: pt[k].y, z: pt[k].z } }; break; }
    if (!out) {
      const peek = scanCachePeek(r, typeId);
      if (peek.state === "hit") out = { state: "present", source: "cache", confidence: 1, loc: peek.loc };
      else if (peek.state === "absent") { const ent = r.mScanMap?.[typeId]; const f = ent?.failedCells ?? 0, t = ent?.totalCells ?? 2601; out = { state: "absent", source: "cache", confidence: Math.max(0, Math.min(1, 1 - f / t)), loc: null }; }
      else if (peek.state === "unknown") out = { state: "unknown", source: "cache", confidence: 0, loc: null };
      else { const loc = scanBlockNear(bot, r, typeId); const ent = r.mScanMap?.[typeId]; const f = ent?.failedCells ?? 0, t = ent?.totalCells ?? 2601; out = loc ? { state: "present", source: "scan", confidence: 1, loc } : (f * 2 > t ? { state: "unknown", source: "scan", confidence: 0, loc: null } : { state: "absent", source: "scan", confidence: Math.max(0, Math.min(1, 1 - f / t)), loc: null }); }
    }
  } catch { out = { state: "unknown", source: "scan", confidence: 0, loc: null }; }
  try { const prev = r.lastInspect; r.lastInspect = { act: "INSPECT", state: out.state, source: out.source, confidence: out.confidence, typeId, at: Date.now() };
    // 6-ML INSPECT 層2 (cycle1923): 整形して commit へ渡す。同 typeId+state の連続観測は間引く (EXPストア占有防止)。素朴形 (ok欠落) の commit は汚染形のため禁止 (a04 §3)
    if (!prev || prev.typeId !== typeId || prev.state !== out.state) commitLastAction(r, { act: "INSPECT", ok: out.state !== "unknown", reason: out.state === "unknown" ? "TARGET_UNKNOWN" : null, item: typeId, via: out.source, at: r.lastInspect.at, detail: { state: out.state, source: out.source, confidence: out.confidence } });
  } catch {}
  return out;
}
// Phase2 WITHDRAW 実体 (v0.4.8 Step A): withdraw.js executor へ実API ports を接続する。呼び出し口 (mission/planner) は Step B 以降
function runWithdraw(bot, r, args) {
  const home = args?.from?.home === true ? homeOf(bot) : null;
  const targetPos = home ? { x: home.x, y: home.y, z: home.z } : (args?.from?.block ? { x: args.from.block.x, y: args.from.block.y, z: args.from.block.z } : args?.from);
  const targetDim = home ? home.dim : (args?.from?.block?.dim || args?.from?.dim || bot.dimension.id);
  const getBlockSafe = () => { try { return bot.dimension.getBlock({ x: Math.floor(targetPos.x), y: Math.floor(targetPos.y), z: Math.floor(targetPos.z) }) || null; } catch { return null; } };
  const getSrcCont = () => { const b = getBlockSafe(); if (!b) return null; try { return b.getComponent("minecraft:inventory")?.container || null; } catch { return null; } };
  const slotsOf = (cont) => { const out = []; if (!cont) return out; for (let i = 0; i < cont.size; i++) { let st = null; try { st = cont.getItem(i); } catch {} out.push(st ? { typeId: st.typeId, amount: st.amount, maxAmount: st.maxAmount || 64 } : null); } return out; };
  const ex = createWithdrawExecutor({
    readSnapshot: () => {
      const b = (targetDim === bot.dimension.id) ? getBlockSafe() : null;
      let contKnown = false, contPresent = false;
      if (b) { contKnown = true; try { contPresent = !!b.getComponent("minecraft:inventory")?.container; } catch { contKnown = false; } }
      let wasKnown = false; try { const wm = wmemOf(bot); wasKnown = !!(wm?.getContainer && targetPos && wm.getContainer(targetPos, targetDim)); } catch {}
      return { botDim: bot.dimension.id, fromDim: targetDim, distance: targetPos ? dist(bot.location, { x: targetPos.x + 0.5, y: targetPos.y + 0.5, z: targetPos.z + 0.5 }) : null, invKnown: !!invOf(bot), blockReadOk: targetDim !== bot.dimension.id ? true : !!b, blockType: targetDim !== bot.dimension.id ? null : (b ? b.typeId : null), wasKnownContainer: wasKnown, containerKnown: contKnown, containerPresent: contPresent };
    },
    readSrcSlots: () => slotsOf(getSrcCont()),
    readBotSlots: () => slotsOf(invOf(bot)),
    applyTransfer: (srcAfter, dstAfter, transfers) => {
      const sc = getSrcCont(), bc = invOf(bot); if (!sc || !bc) return false;
      for (const t of transfers) {
        let srcStack = null; try { srcStack = sc.getItem(t.srcSlot); } catch {}
        if (!srcStack || t.moved <= 0) continue;
        let give = null; try { give = srcStack.clone(); give.amount = t.moved; } catch { return false; }
        let rest = null; try { rest = bc.addItem(give); } catch { return false; }
        const actually = t.moved - (rest ? rest.amount : 0);
        if (actually > 0) { try { const remain = srcStack.amount - actually; if (remain > 0) { const ns = srcStack.clone(); ns.amount = remain; sc.setItem(t.srcSlot, ns); } else sc.setItem(t.srcSlot, undefined); } catch { return false; } }
      }
      return true;
    },
    onScanned: (info) => { try { const wm = wmemOf(bot); if (wm?.recordContainer && targetPos) wm.recordContainer(targetPos, targetDim, { kind: info.blockType || undefined, source: "direct_inspect", confidence: 1, ...(info?.contents && typeof info.contents === "object" ? { contents: info.contents } : {}) }); } catch {} }, // Step2 (v0.4.18): contents が載っているときだけ転送
    onForget: () => { try { const wm = wmemOf(bot); if (wm?.forgetContainer && targetPos) wm.forgetContainer(targetPos, targetDim); } catch {} },
  }, { extraContainers: OF_CONTAINERS });
  const res = ex.withdraw(args);
  recordWithdraw(bot, r, res);
  return res;
}
// Phase2 WITHDRAW Step B (v0.4.11): 既知コンテナ候補の供給。在庫は world_memory が保持しないため断定せず、確定は executor の stock が担う
function buildWithdrawCandidate(bot, r, m, step) {
  try {
    if (!m) return null;
    const wm = wmemOf(bot);
    const list = wm?.knownContainers ? wm.knownContainers(bot.dimension.id) : [];
    if (!(r.withdrawBlocked instanceof Set)) r.withdrawBlocked = new Set();
    return selectWithdrawCandidate({ stepType: step?.type, detour: m.detour, blockedStatus: m.blocked, need: step?.need, have: step?.have, now: Date.now(), cooldownUntil: r.withdrawCooldownUntil || 0, item: step?.target, logBlockIds: LOG_BLOCK_IDS, containers: list, selfPos: bot.location, dim: bot.dimension.id, blockedKeys: r.withdrawBlocked, stepIndex: m.currentStep });
  } catch { return null; }
}
// Phase2 WITHDRAW Step B: 実行結果の後処理。確定情報だけ blocked 集合へ、unknown 系は cooldown のみ。進捗は measure() 実測のみ (二重計上禁止)
function handleWithdrawResult(bot, r, m, cand, res) {
  try {
    if (!(r.withdrawBlocked instanceof Set)) r.withdrawBlocked = new Set();
    const key = `${m?.currentStep ?? 0}:${cand.dim || bot.dimension.id}:${cand.x},${cand.y},${cand.z}:${cand.item}`;
    const block = () => { r.withdrawBlocked.add(key); if (r.withdrawBlocked.size > 64) { const cur = `${m?.currentStep ?? 0}:`; r.withdrawBlocked = new Set([...r.withdrawBlocked].filter((k) => String(k).startsWith(cur))); } }; // cycle2333 WITHDRAW-BLOCKED-CLEARALL 是正: 全消去をやめ現ステップ以外のキーだけ落とす (候補枯渇の完了状態へ到達可能にする)
    const cool = () => { r.withdrawCooldownUntil = Date.now() + 30000; };
    if (!res) { cool(); return; }
    if (res.ok) { if (res.detail?.partial && (res.detail.stock ?? 0) <= (res.detail.taken ?? 0)) block(); return; }
    switch (res.reason) {
      case "ITEM_NOT_FOUND": case "TARGET_MISSING": case "NOT_A_CONTAINER": case "WRONG_DIMENSION": block(); break;
      case "TARGET_UNKNOWN": case "VERIFY_FAILED": case "API_ERROR": cool(); break;
      case "INVENTORY_FULL": case "OUT_OF_RANGE": case "NOT_IMPLEMENTED": break;
      default: cool(); break;
    }
  } catch {}
}
function itemTypeOf(e) { try { return e.getComponent("minecraft:item")?.itemStack?.typeId || null; } catch { return null; } }
const LOG_BLOCK_IDS = ["minecraft:oak_log", "minecraft:spruce_log", "minecraft:birch_log", "minecraft:jungle_log", "minecraft:acacia_log", "minecraft:dark_oak_log", "minecraft:mangrove_log", "minecraft:cherry_log", "minecraft:pale_oak_log"];

// ---------- v0.4.66: チャンク調査 (区画 = 4×4 チャンク = 64×64 ブロック、高さ全体) ----------
// リゼのいる区画を 1 tick に 1 チャンクずつ getBlocks で調べ、原木と鉱石の位置を記録する。
// 地下の鉱石も分かる。見つからなければ mission 側の探索が「まだ調べていない隣の区画」へ向かう。
// チャンクは読み込まれている必要があるため、エンティティ側に minecraft:tick_world (半径4チャンク) を付けて、
// リゼ自身がチャンクローダーとして周囲を読み込み続ける。
const ORE_IDS = ["coal_ore", "deepslate_coal_ore", "iron_ore", "deepslate_iron_ore", "copper_ore", "deepslate_copper_ore",
  "gold_ore", "deepslate_gold_ore", "redstone_ore", "deepslate_redstone_ore", "lit_redstone_ore", "lit_deepslate_redstone_ore",
  "lapis_ore", "deepslate_lapis_ore", "diamond_ore", "deepslate_diamond_ore", "emerald_ore", "deepslate_emerald_ore",
  "nether_gold_ore", "quartz_ore", "ancient_debris"].map((x) => "minecraft:" + x);
const SURVEY_IDS = [...LOG_BLOCK_IDS, ...ORE_IDS];
const REGION_SIZE = 64;                 // 4 チャンク
const SURVEY_TTL_MS = 15 * 60 * 1000;   // 調査結果の保持時間
const SURVEY_HITS_CAP = 96;             // 区画ごと・種類ごとに覚える位置の上限
const SURVEY_ITER_CAP = 1200;           // 1 チャンクで見る一致位置の上限
const EXPLORE_MAX_RING = 3;             // 探索開始区画から何区画先まで調べに行くか (±3 = 7×7 区画 ≒ ±220 ブロック)
const surveys = new Map();              // "dim:rx,rz" -> { dim, rx, rz, at, doneMask, fails, hits: { typeId: [{x,y,z}] } }
let surveyIds = SURVEY_IDS.slice();     // 使えない ID が見つかったら外す
let surveyLatch = createSurveyLatch(); // cycle0628: 旧 surveyBroken (恒久ラッチ) を survey_broken.js のラッチ (クールダウン回復つき) へ置換
let surveyGlobalEvents = []; // cycle0628: 区画隔離イベントの直近ログ (全体 trip の拡散判定用)
let surveySlowUntil = 0;
let surveyRR = 0; // 調査する区画の巡回カウンタ (今いる区画を優先しつつ、隣の区画も少しずつ進める)
const regionOf = (x, z) => ({ rx: Math.floor(x / REGION_SIZE), rz: Math.floor(z / REGION_SIZE) });
const surveyKeyOf = (dimId, rx, rz) => `${dimId}:${rx},${rz}`;
function surveyFresh(sv) { return !!sv && Date.now() - sv.at < SURVEY_TTL_MS; }
// F1分離 (cycle1909): surveyDone は「調べ終えた事実」のラッチ述語。鮮度は含めない。
// ヒットの新しさは surveyFresh / hintFresh 側が従来どおり at+TTL で判定する (読み手は分離済み)。
function surveyDone(sv) { return !!sv && sv.doneMask === 0xffff && sv.doneAt != null; }
// 完了の書き込みはこの1箇所に寄せる: doneMask と doneAt と at を同一 now で書く。
function markSurveyDone(sv) { const now = Date.now(); sv.doneMask = 0xffff; sv.doneAt = now; sv.at = now; }
function surveyAvailable() { try { surveyLatch = recoverSurveyLatch(surveyLatch, Date.now()).latch; } catch {} return surveyLatchAvailable(surveyLatch, Date.now()) && !!mcServer.BlockVolume; } // cycle0628: 述語の呼び出し時に遅延回復を書き戻す (実行部が止まっていてもクールダウンで回復する)
function requestSurvey(dimId, rx, rz, prio = 1) {
  if (!surveyAvailable()) return null;
  const key = surveyKeyOf(dimId, rx, rz);
  let sv = surveys.get(key);
  if (!sv) { sv = { dim: dimId, rx, rz, at: Date.now(), doneMask: 0, doneAt: null, fails: 0, hits: {}, wantAt: Date.now() }; surveys.set(key, sv); }
  else if (!surveyFresh(sv) && !surveyDone(sv)) { // SURVEY-PARTIAL-UNLOADED-RESET 是正 (cycle0252 案A): 部分進捗 (doneMask!=0) かヒットがある区画は鮮度切れで消さず at だけ打ち直す (調べた事実は鮮度と分離)。hits/seen は対で保持し units も保持する。陳腐ヒットの誤誘導は lookupSurvey の実ブロック再検証で止まる
    if (sv.doneMask !== 0 || (sv.hits && Object.keys(sv.hits).length > 0)) { sv.at = Date.now(); }
    else { sv.doneMask = 0; sv.doneAt = null; sv.fails = 0; sv.hits = {}; sv.seen = {}; sv.units = undefined; sv.nextIdx = 0; sv.at = Date.now(); } // survey 案R (cycle2036): seen も hits と対で初期化
  }
  // ラッチ済み sv は失効しても作り直さない: doneMask/doneAt/hits は保持し、wantAt/prio のみ更新する。
  sv.wantAt = Date.now(); sv.prio = prio;
  if (surveys.size > 400) { const old = pickSurveyEvictions([...surveys.entries()], 100, Date.now(), SURVEY_TTL_MS); for (const [k] of old) surveys.delete(k); } // survey 案C (cycle2006): 複合削除キー (survey_evict.js)
  return sv;
}
// survey CAP B-prime (cycle1703): unit-based progress helpers. splitVolume untouched (shared utility)
function halveUnit(va, vb) {
  const sx = vb.x - va.x + 1, sy = vb.y - va.y + 1, sz = vb.z - va.z + 1;
  if (sx <= 1 && sy <= 1 && sz <= 1) return null;
  if (sy >= sx && sy >= sz) { const m = va.y + Math.floor(sy / 2) - 1; return [[va, { ...vb, y: m }], [{ ...va, y: m + 1 }, vb]]; }
  if (sx >= sz) { const m = va.x + Math.floor(sx / 2) - 1; return [[va, { ...vb, x: m }], [{ ...va, x: m + 1 }, vb]]; }
  const m = va.z + Math.floor(sz / 2) - 1; return [[va, { ...vb, z: m }], [{ ...va, z: m + 1 }, vb]];
}
function recordHit(sv, id, loc) {
  recordHitReservoir(sv, id, loc, SURVEY_HITS_CAP); // survey 案R (cycle2036): drop-new を廃しリザーバサンプリングへ委譲 (survey_reservoir.js が単一の正)
}
// 1 chunk survey. Returns: "done" | "partial" | "unloaded" | "error"  (partial = progress saved in sv.units)
function surveyChunk(sv, idx) {
  const dim = world.getDimension(sv.dim);
  const cx = sv.rx * 4 + (idx & 3), cz = sv.rz * 4 + (idx >> 2);
  let minY = -64, maxY = 319; try { minY = dim.heightRange.min; maxY = dim.heightRange.max - 1; } catch {}
  if (!sv.units) sv.units = {};
  if (!sv.units[idx]) sv.units[idx] = splitVolume({ x: cx * 16, y: minY, z: cz * 16 }, { x: cx * 16 + 15, y: maxY, z: cz * 16 + 15 });
  const stack = sv.units[idx];
  let budget = 0;
  while (stack.length > 0) {
    const unit = stack[stack.length - 1];
    const freshStart = budget === 0;
    let list = null;
    try { list = dim.getBlocks(new mcServer.BlockVolume(unit[0], unit[1]), { includeTypes: surveyIds }, false); }
    catch (err) {
      const msg = String(err && (err.name || "") + " " + (err.message || err));
      if (/unloaded/i.test(msg)) return "unloaded";
      warnOnce("survey:" + msg.slice(0, 60), `[LIZE] chunk survey error: ${msg}`);
      if (!sv.idCheck) {
        sv.idCheck = true;
        const okIds = [];
        for (const id of surveyIds) { try { dim.containsBlock(new mcServer.BlockVolume({ x: cx * 16, y: 0, z: cz * 16 }, { x: cx * 16, y: 0, z: cz * 16 }), { includeTypes: [id] }, true); okIds.push(id); } catch {} }
        if (okIds.length && okIds.length < surveyIds.length) { surveyIds = okIds; return "error"; }
      }
      return "error";
    }
    let truncated = false;
    for (const loc of list.getBlockLocationIterator()) {
      if (++budget > SURVEY_ITER_CAP) { truncated = true; break; }
      let id = null; try { id = dim.getBlock(loc)?.typeId ?? null; } catch {}
      if (!id) continue;
      recordHit(sv, id, loc);
    }
    if (!truncated) { stack.pop(); continue; }
    if (freshStart) {
      stack.pop();
      const halves = halveUnit(unit[0], unit[1]);
      if (halves) for (const h of halves) stack.push(h);
    }
    return "partial";
  }
  return "done";
}
// 調査の実行: 毎 tick、待ちのある区画を 1 チャンクだけ進める (重い時は間引く)
system.runInterval(() => {
  if (!surveyAvailable() || Date.now() < surveySlowUntil) return;
  const queue = [];
  for (const v of surveys.values()) if (surveyFresh(v) && v.doneMask !== 0xffff && Date.now() - (v.wantAt || 0) < 10000 && !(v.quarantinedUntil > Date.now()) && !(v.unloadedUntil > Date.now())) queue.push(v); // cycle0628: 隔離中の区画は選ばない (隔離は当該区画だけ・全体は止めない) / cyc2369 SURVEY-UNLOADED-NOEXIT-01: unloaded 一時除外中も選ばない
  if (!queue.length) return;
  queue.sort((a, b) => (b.prio || 0) - (a.prio || 0) || (b.wantAt || 0) - (a.wantAt || 0));
  // 偶数 tick は最優先 (今いる区画)、奇数 tick は残りを順番に。今いる区画が終わっていれば隣だけを進める
  surveyRR++;
  const sv = (surveyRR % 2 === 0 || queue.length === 1) ? queue[0] : queue[1 + (Math.floor(surveyRR / 2) % (queue.length - 1))];
  const start = sv.nextIdx || 0;
  for (let k = 0; k < 16; k++) {
    const idx = (start + k) % 16;
    if (sv.doneMask & (1 << idx)) continue;
    const t0 = Date.now();
    let res = "error"; try { res = surveyChunk(sv, idx); } catch { res = "error"; }
    const ms = Date.now() - t0;
    if (ms > 25) surveySlowUntil = Date.now() + ms * 2; // 処理落ち防止: 重かった分だけ次を遅らせる
    sv.nextIdx = (idx + 1) % 16;
    if (res === "done") { sv.fails = 0; sv.unloadedStreak = 0; sv.doneMask |= (1 << idx); sv.at = Date.now(); sv.wantAt = sv.at; if (sv.doneMask === 0xffff && sv.doneAt == null) sv.doneAt = sv.at; } // cyc2367 SURVEY-WANTAT-FREEZE-01: 進捗が wantAt 窓も供給する
    else if (res === "partial") { sv.fails = 0; sv.unloadedStreak = 0; sv.at = Date.now(); sv.wantAt = sv.at; } // cyc2367 SURVEY-WANTAT-FREEZE-01 // B-prime: progress refreshes freshness only / cycle0628: 進捗で fails リセット (survey_broken.js の nextFails と同義。断片抽出ハーネスと両立させるため実行部は自己完結形で書く)
    else if (res === "error") { sv.fails++; if (sv.fails > 40) { sv.quarantinedUntil = Date.now() + 900000; sv.fails = 0; /* cycle0659: reset fails on quarantine */ try { surveyGlobalEvents = pruneGlobalErrorEvents([...surveyGlobalEvents, { key: surveyKeyOf(sv.dim, sv.rx, sv.rz), at: Date.now() }], Date.now()); if (shouldTripGlobalLatch(surveyGlobalEvents, Date.now())) { surveyLatch = tripSurveyLatch(surveyLatch, Date.now()); console.warn("[LIZE] chunk survey paused (failures spread across regions, cooldown recovery)"); } } catch {} } } // cycle0628: 単一区画の失敗では全体を止めず当該区画だけ15分隔離。全体停止は複数区画への拡散時のみ＋5分クールダウンで回復 (恒久ラッチ surveyBroken は廃止)
    else if (res === "unloaded") { sv.unloadedStreak = (sv.unloadedStreak || 0) + 1; if (sv.unloadedStreak >= 32) { sv.unloadedUntil = Date.now() + 60000; sv.unloadedStreak = 0; } } // cyc2369 SURVEY-UNLOADED-NOEXIT-01: 失敗でも進捗でもないので fails には載せず、専用カウンタ32回(2巡)で60秒の一時除外にする
// unloaded は次の tick に別のチャンクを試す (リゼが近づけば読み込まれる)
    break;
  }
}, 1);
// 調査結果から、指定 ID の一番近い位置を探す (ban 中の位置は除く)。現物が変わっていたら記録から消す
function lookupSurvey(bot, ids, banKey = null) {
  if (!surveyAvailable()) return null;
  const dimId = bot.dimension.id, p = bot.location;
  const { rx, rz } = regionOf(p.x, p.z);
  const want = new Set(ids);
  const cands = [];
  for (const sv of surveys.values()) {
    if (sv.dim !== dimId || (!surveyFresh(sv) && !surveyDone(sv))) continue; // cyc2363 A13 RESID-A13-01: done ラッチ済み区画の記録済みヒットは鮮度で捨てない (現物は下の getBlock 再検証で淘汰される)
    if (Math.abs(sv.rx - rx) > EXPLORE_MAX_RING + 1 || Math.abs(sv.rz - rz) > EXPLORE_MAX_RING + 1) continue;
    for (const id of Object.keys(sv.hits)) {
      if (!want.has(id)) continue;
      for (const loc of sv.hits[id]) {
        if (banKey && matchesBan(loc, id, banKey)) continue; // queue0-A bug2 (cycle1728): trunk-unit ban matching
        const dx = loc.x - p.x, dy = loc.y - p.y, dz = loc.z - p.z;
        cands.push({ sv, id, loc, d: dx * dx + dz * dz + dy * dy * 2.25 });
      }
    }
  }
  cands.sort((a, b) => a.d - b.d);
  for (const c of cands.slice(0, 12)) {
    let b = null; try { b = bot.dimension.getBlock(c.loc); } catch {}
    if (!b) continue; // PK-0117-01 B最小形 (cycle0153): 未読候補はその回だけ不採用 (記録は消さない)
    if (b && b.typeId !== c.id) { const arr = c.sv.hits[c.id]; const i = arr.indexOf(c.loc); if (i >= 0) arr.splice(i, 1); continue; } // もう無い (掘られた等)
    if (b && !cropMatureAt(bot.dimension, c.loc, c.id)) continue; // cycle2311: survey 経由でも未成熟作物は候補にしない (記録は消さない: 成熟すれば候補に戻る)
    return { loc: { ...c.loc }, typeId: c.id };
  }
  return null;
}
// 探索: 中心区画から近い順に、まだ調べ終えていない区画を返す。全部調べ終えていれば null
function nextExploreRegion(dimId, center, from) {
  const c = regionOf(center.x, center.z);
  const list = [];
  for (let dx = -EXPLORE_MAX_RING; dx <= EXPLORE_MAX_RING; dx++) for (let dz = -EXPLORE_MAX_RING; dz <= EXPLORE_MAX_RING; dz++) {
    const rx = c.rx + dx, rz = c.rz + dz;
    if (surveyDone(surveys.get(surveyKeyOf(dimId, rx, rz)))) continue;
    const mx = rx * REGION_SIZE + REGION_SIZE / 2, mz = rz * REGION_SIZE + REGION_SIZE / 2;
    const ring = Math.max(Math.abs(dx), Math.abs(dz));
    list.push({ rx, rz, x: mx, z: mz, ring, d: Math.hypot(mx - from.x, mz - from.z) });
  }
  if (!list.length) return null;
  list.sort((a, b) => a.ring - b.ring || a.d - b.d); // 内側の輪から、今いる場所に近い順
  return list[0];
}
// ---------- v0.4.66: 地下の対象へのトンネル掘り ----------
// 対象が地中にあって立ち位置が無いとき、1×2 の通路を階段状に掘って近づく。溶岩が隣接するマスは掘らない。
const TUNNEL_DIG_PER_TICK = 6; // 1 マスあたりの掘り回数の上限 (石 4・深層岩 6)
// 真上に「地形」の固いブロック (葉・原木・草花は数えない) が 2 つ以上あれば地中とみなす。
// 木の幹は真上が葉や原木なので地中にならない (以前は葉で地中と誤判定し、空中をトンネル掘りで 1 秒 1 マスずつ進んでいた)
function isUnderground(bot, loc) {
  try {
    const dim = bot.dimension; const top = dim.getTopmostBlock({ x: loc.x, z: loc.z });
    if (!top || top.location.y <= loc.y) return false;
    // cycle1400: 数え上げは underground_math の純粋核へ移譲 (規則は同一、雪層の扱いをテストで固定)
    return isUndergroundColumn((y) => { try { const b = dim.getBlock({ x: loc.x, y, z: loc.z }); return b ? b.typeId : null; } catch { return null; } }, solidOfTypeId, loc.y, top.location.y);
  } catch { return false; }
}
function shouldTunnel(bot, r, loc) {
  // H0900-T1 (cycle0955): 地表作物は tunnel 適格外 (work 経路固定)。継続判定より先に置き、誤発動した tunnel も作物対象では継続しない
  try { const tb = bot.dimension.getBlock(loc); if (tb && isCropBlock(tb.typeId)) return false; } catch {}
  const eye = { x: bot.location.x, y: bot.location.y + 1.6, z: bot.location.z };
  if (dist(eye, { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 }) <= WORK_REACH) return false; // 手が届くなら普通に掘る
  if (r.tunnel && r.tunnel.key === `${loc.x},${loc.y},${loc.z}`) return true;                       // 掘り始めたら続ける
  return !workStandPoint(bot, loc) || isUnderground(bot, loc);
}
function lavaNear(dim, c) {
  for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
    try { const b = dim.getBlock({ x: c.x + dx, y: c.y + dy, z: c.z + dz }); if (b && b.typeId.includes("lava")) return true; } catch {}
  }
  return false;
}
function abandonTunnel(bot, owner, r, why) {
  r.mBanKey = banKeyFor(r.mTargetLoc, r.mTargetType) || r.mTargetKey; r.mBanUntil = Date.now() + 120000; r.mTargetLoc = null; r.mTargetKey = ""; r.mTargetSince = Date.now(); // queue0-A bug2 (cycle1728): trunk-unit ban
  r.tunnel = null; r.d2Anchor = null; r.work = null;
  try { r.lastBreak = { act: "BREAK", ok: false, reason: why, item: null, at: Date.now() }; commitLastAction(r, r.lastBreak); } catch {}
  if (!r.tunnelWarnAt || Date.now() - r.tunnelWarnAt > 60000) { r.tunnelWarnAt = Date.now(); try { say(owner, bot, why === "LAVA" ? "その先は溶岩があります。別の鉱石を探します" : "そこへは掘り進めませんでした。別のものを探します", true); } catch {} }
}
// 掘った道をたどって地上へ戻る。掘り作業中でなく、地中にいて、行き先が 6 ブロック以上先のときだけ
function exitTunnelIfNeeded(bot, r) {
  try {
    if (!r.tunnelPath || !r.tunnelPath.length) { r.tunnelExiting = false; r.tunnelExitHold = null; return; }
    if (r.tunnelExiting && r.work) r.work = null; // 戻る間は掘りかけを捨てる
    const p = bot.location;
    const last = r.tunnelPath[r.tunnelPath.length - 1];
    if (dist(p, last) > 16) { r.tunnelPath = []; r.tunnelExiting = false; r.tunnelExitHold = null; return; } // 呼び戻し等の別手段で離れた: 道はもう使わない
    if (!r.tunnelExiting) {
      // v0.4.68: 手の届かない場所の古い作業 (掘り終えた後に残った r.work) は「作業中」とみなさない
      let working = !!(r.work && r.work.loc && Date.now() - (r.work.touchedAt || 0) < 3000 && dist({ x: p.x, y: p.y + 1.6, z: p.z }, { x: r.work.loc.x + 0.5, y: r.work.loc.y + 0.5, z: r.work.loc.z + 0.5 }) <= WORK_REACH + 1);
      if (working) { try { const wb = bot.dimension.getBlock(r.work.loc); if (!wb || wb.typeId !== r.work.typeId) { working = false; r.work = null; } } catch {} } // 掘り終えて空気になった作業は捨てる
      if (r.tunnel || working || !r.target || dist(p, r.target) < 6) return;
      // 帰り道が残っている = 自分で掘ったトンネルの中。真上が自分で掘った縦穴だと地形判定では地上に見えるので、記録で判断する
      r.tunnelExiting = true; // 戻り始めたら入口まで戻り切る (地表の手前で止まると、斜めの通路から出られない)
    }
    let step = null;
    for (let i = 0; i < 4 && r.tunnelPath.length; i++) {
      const cand = r.tunnelPath.pop();
      const g = tunnelGateDest(bot, r, cand); // queue3 step3: 帰路も tunnel ゲート経由 (再充填セルへ無検査で入らない)
      if (!g.dest) { // hold: step not consumed (returned to path). cycle0033 F4: cumulative hold clock (branchmine holdHeld shape); over 30s discard path and delegate to normal movement
        r.tunnelPath.push(cand);
        try {
          const now = Date.now(), key = `${cand.x},${cand.y},${cand.z}`;
          if (!r.tunnelExitHold || r.tunnelExitHold.key !== key) r.tunnelExitHold = { key, totalMs: 0, lastAt: now, noted: false };
          const th = r.tunnelExitHold;
          if (th.lastAt && now > th.lastAt) th.totalMs += Math.min(now - th.lastAt, 2000); // TUNNEL-EXIT-HOLD-SPARSE-DISCARD 是正 (cycle0252): 間隔2000ms以上の丸ごと破棄をキャップ加算へ (holdHeld 是正と同型)
          th.lastAt = now;
          if (!th.noted) { th.noted = true; noteFail(bot, "tunnel:exit_hold", new Error(key)); }
          if (th.totalMs > 30000) { noteFail(bot, "tunnel:exit_hold_exhausted", new Error(key)); r.tunnelPath = []; r.tunnelExiting = false; r.tunnelExitHold = null; }
        } catch {}
        break;
      }
      step = g.dest; r.tunnelExitHold = null; try { bot.teleport(step); } catch {}
    }
    if (!r.tunnelPath.length) r.tunnelExiting = false;
    if (step) r.target = { ...step };
  } catch {}
}
function tickTunnel(bot, owner, r, ctx, goal) {
  const dim = bot.dimension, pos = bot.location;
  const key = `${goal.x},${goal.y},${goal.z}`;
  if (!r.tunnel || r.tunnel.key !== key) r.tunnel = { key, lastStepAt: Date.now(), steps: 0 };
  const bx = Math.floor(pos.x), by = Math.floor(pos.y), bz = Math.floor(pos.z);
  const dx = goal.x - bx, dy = goal.y - by, dz = goal.z - bz;
  // 水平に遠い対象は、地上を飛んで真上まで行ってから掘り下げる (地中を横に掘り進むより速い)
  const hd = Math.hypot(goal.x + 0.5 - pos.x, goal.z + 0.5 - pos.z);
  if (hd > 6) {
    if (r.tunnelPath && r.tunnelPath.length) { r.tunnelExiting = true; r.target = { ...r.tunnelPath[r.tunnelPath.length - 1] }; return; } // まず掘った道をたどって地上へ
    if (!isUnderground(bot, { x: bx, y: by, z: bz })) {
      let topY = goal.y; try { const top = dim.getTopmostBlock({ x: goal.x, z: goal.z }); if (top) topY = top.location.y + 1; } catch {}
      r.target = { x: goal.x + 0.5, y: Math.max(topY + 1.2, pos.y), z: goal.z + 0.5 };
      if (r.tunnel.bestHd === undefined || hd < r.tunnel.bestHd - 1) { r.tunnel.bestHd = hd; r.mTargetSince = Date.now(); } // 近づいている間は「進捗あり」
      return;
    }
  }
  let next, cells, spiralOff = false;
  // 0-D2 (cycle1434): 深い真下対象は1x1垂直掘りにせず螺旋階段で降りる。現在位置が階段の段と一致するときだけ委譲し、それ以外は従来分岐 (露出・浅い対象は従来どおり直接掘り)。
  // D2-R1-U1 (cyc2390): spiral 分類のときは段との整合を先に判定する。階段上にいて steps だけずれている (対象 key 変化で steps が 0 に戻る等) 場合は steps を実位置へ再同期して螺旋を続行し、階段上にいない場合は縦穴フォールバックへ落とさず明示中断する (D2_OFF_STAIRCASE)。anchor は作り直さない (G2)。
  try {
    const plan = d2Classify({ x: bx, y: by, z: bz }, { x: goal.x, y: goal.y, z: goal.z }, {});
    if (plan && plan.mode === "spiral") {
      r.d2Anchor = d2EnsureAnchor(r.d2Anchor, { x: bx, y: by, z: bz }, { x: goal.x, y: goal.y, z: goal.z }); // G2: 既存起点があれば対象が変わっても同一参照 (作り直さない)
      const dsy = d2Desync(r.d2Anchor, r.tunnel.steps, { x: bx, y: by, z: bz });
      if (dsy && dsy.action === "resync") { r.tunnel.steps = dsy.index; r.tunnel.d2Resyncs = (r.tunnel.d2Resyncs || 0) + 1; }
      else if (dsy && dsy.action === "off") spiralOff = true;
      if (!spiralOff) {
        const cur = d2StepAt(r.d2Anchor, r.tunnel.steps), nxt = d2StepAt(r.d2Anchor, r.tunnel.steps + 1);
        if (cur && nxt && cur.x === bx && cur.y === by && cur.z === bz && Math.abs(nxt.x - bx) + Math.abs(nxt.z - bz) <= 1) { next = { x: nxt.x, y: nxt.y, z: nxt.z }; cells = [next, { x: next.x, y: next.y + 1, z: next.z }]; r.tunnel.d2Spiral = true; }
      }
    }
  } catch {}
  if (spiralOff) { abandonTunnel(bot, owner, r, "D2_OFF_STAIRCASE"); return; } // D2-R1-U1: 掘削セルを作る前に明示中断 (縦穴を作らない)
  if (!next) {
  if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1 && dy < -1) { next = { x: bx, y: by - 1, z: bz }; cells = [next]; }                       // 真下へ
  else if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1 && dy > 2) { next = { x: bx, y: by + 1, z: bz }; cells = [{ x: bx, y: by + 2, z: bz }]; } // 真上へ
  else {
    const sx = Math.abs(dx) >= Math.abs(dz) ? Math.sign(dx) : 0, sz = sx === 0 ? Math.sign(dz) : 0;
    const ny = dy < -1 ? by - 1 : dy > 1 ? by + 1 : by;                                                                      // 階段状に上下
    next = { x: bx + sx, y: ny, z: bz + sz };
    cells = [next, { x: next.x, y: ny + 1, z: next.z }];
    if (ny > by) cells.push({ x: bx, y: by + 2, z: bz });                                                                     // 上り階段は頭上も
  }
  }
  for (const c of cells) if (lavaNear(dim, c)) { abandonTunnel(bot, owner, r, "LAVA"); return; }
  for (const c of cells) {
    let b = null; try { b = dim.getBlock(c); } catch {}
    if (!b) { r.target = { x: pos.x, y: pos.y, z: pos.z }; return; }                                                         // 未読: その場で待つ
    if (b.typeId === "minecraft:air") continue;
    if (b.isLiquid || b.typeId === "minecraft:bedrock") { abandonTunnel(bot, owner, r, b.isLiquid ? "LIQUID" : "BEDROCK"); return; }
    if (!startWork(bot, r, { x: c.x, y: c.y, z: c.z, typeId: b.typeId }, { skipAccess: true })) { abandonTunnel(bot, owner, r, "GUARDED"); return; } // v0.4.76 a06 M3: 坑道セル自体が対象なので遮蔽解決はしない
    for (let i = 0; i < TUNNEL_DIG_PER_TICK && r.work; i++) tickWork(bot, owner, r, ctx);
    if (r.lastBreak && r.lastBreak.ok === false && r.lastBreak.reason === "TOOL_INSUFFICIENT") { abandonTunnel(bot, owner, r, "TOOL_INSUFFICIENT"); return; }
    r.target = { x: pos.x, y: pos.y, z: pos.z };
    r.tunnel.lastStepAt = Date.now(); r.mTargetSince = Date.now(); // 掘っている間は「進捗あり」
    if (r.work) return;   // まだ掘り切れていない (硬いブロック): 次の判断で続き
    // 掘り切れたら、同じ判断の中で通路の次のマスへ (1 回で 2 マス掘れる)
    let bb = null; try { bb = dim.getBlock(c); } catch {}
    if (bb && bb.typeId !== "minecraft:air") return;
  }
  // 通路が開いた → 1 マス進む
  const dest = { x: next.x + 0.5, y: next.y, z: next.z + 0.5 };
  const tg = tunnelGateDest(bot, r, dest); // queue3 step3: 前進も tunnel ゲート経由 (落下ブロックの再充填へ入らない)
  if (!tg.dest) { r.target = { x: pos.x, y: pos.y, z: pos.z }; return; } // hold: steps を進めず現在位置に留まる
  if (!r.tunnelPath) r.tunnelPath = [];
  r.tunnelPath.push({ x: pos.x, y: pos.y, z: pos.z }); if (r.tunnelPath.length > 400) r.tunnelPath.shift(); // 帰り道
  try { bot.teleport(tg.dest); } catch {}
  r.target = tg.dest; r.tunnel.steps++; r.tunnel.lastStepAt = Date.now(); r.mTargetSince = Date.now();
}
function findMissionTarget(bot, r, scan, step, scanUnknown = false) {
  const target = step.target;
  if (step.type === "hunt_entity") {
    let e = null;
    if (target && target !== "hostile") e = nearestEntityOfType([...(scan?.hostiles || []), ...(scan?.animals || [])].filter((x) => !isEntityBanned(r.mBanKey, r.mBanUntil, Date.now(), x?.id)), target, bot.location); // HUNT-NEAREST-01/HUNT-BAN-CELL-01 (cyc2385): 最寄り選択＋実体ban除外 (従来は走査順 .find)
    else e = scan?.nearestHostile || null; // HUNT-SUBST-01 (cyc2364): 種別指定時は別種への代替をしない。最寄り敵へのフォールバックは汎用指定 "hostile" のときだけ
    return e ? { found: true, kind: "entity", loc: { ...e.location }, typeId: e.typeId, entity: e } : (scanUnknown ? { found: false, detail: { state: "unknown" } } : { found: false }); // typeId は実体の種別を正とする (依頼種別で名乗らない)
  }
  // 原木の扱い (0-D3 是正): 総称指定では全樹種が対象だが、特定樹種の指定ではその樹種だけを対象にする (従来は指定樹種を先頭に置くだけで全樹種が候補だった)
  const tail = String(target || "").split(":").pop();
  if ((step.type === "gather_block" || step.type === "side_collect") && (tail === "log" || tail.endsWith("_log"))) {
    const ids = allowedLogIds(target, LOG_BLOCK_IDS);
    try { if (Array.isArray(r.treeCands) && r.treeCands.length) { const liveT = []; for (const c of r.treeCands) { let t = null; try { t = bot.dimension.getBlock(c.loc)?.typeId || null; } catch {} if (t && t === c.typeId && ids.includes(t)) liveT.push({ loc: c.loc, typeId: t }); else if (!t) liveT.push(c); } const liveTB = filterBanned(liveT, r.mBanKey, r.mBanUntil, Date.now()); r.treeCands = liveTB.filter((c) => { try { return !!bot.dimension.getBlock(c.loc)?.typeId; } catch { return true; } }); const tp = veinPickNearest(r.treeCands, bot.location); if (tp) return { found: true, kind: "block", loc: tp.loc, typeId: tp.typeId, detail: { state: "present", via: "tree" } }; } } catch {} // 0-D3 R1: 同じ木の継続候補を survey/近傍より優先
    // v0.4.64: 全樹種を1回の走査で確定させる (scanBlocksNear)。どれか1種でも stale なら一括走査し、
    // 全種の状態が必ず揃うため pending は発生しない。unknown (走査失敗過半) の扱いは従来どおり。
    if (ids.some((id) => scanCachePeek(r, id).state === "stale")) scanBlocksNear(bot, r, ids);
    let best = null, sawUnknown = false;
    for (const id of ids) {
      const peek = scanCachePeek(r, id);
      if (peek.state === "hit" && peek.loc) { const d = dist(bot.location, peek.loc); if (!best || d < best.d) best = { loc: peek.loc, typeId: id, d }; }
      else if (peek.state === "unknown") sawUnknown = true;
    }
    if (best && isBanned(best.loc, best.typeId, r.mBanKey, r.mBanUntil, Date.now())) best = null; // queue0-A bug2 (cycle1728): banned trunk is not re-selected from scan cache
    if (best) return { found: true, kind: "block", loc: best.loc, typeId: best.typeId, detail: { state: "present" } };
    if (sawUnknown) return { found: false, detail: { state: "unknown" } }; // Step 3b: 測れていない間はドロップへ逸れない
    { const sv = lookupSurvey(bot, ids, Date.now() < (r.mBanUntil || 0) ? r.mBanKey : null); if (sv) return { found: true, kind: "block", loc: sv.loc, typeId: sv.typeId, detail: { state: "present", via: "survey" } }; } // v0.4.66: チャンク調査の結果
    const it = (scan?.items || []).find((x) => ids.includes(itemTypeOf(x))); // 0-D3: ドロップ回収も樹種指定に従う
    if (it) return { found: true, kind: "item", loc: { ...it.location }, typeId: target, entity: it, detail: { state: "present" } };
    return { found: false, detail: { state: "absent" } }; // ここへ来るのは全樹種 absent 確定時のみ (Step 3b)
  }
  const entry = findSources(target);
  const sources = entry ? entry.sources : [];
  let anyUnknown = false;
  // Step 3b R3 (v0.4.13): unknown は記録だけでなく遮断する (後続 source/直接ID/ドロップへ素通りさせない)
  const noteScanState = (id) => { try { if (scanCachePeek(r, id).state === "unknown") { anyUnknown = true; return true; } } catch {} return false; };
  // 0-C R-C4-4 S3 (cyc2381): 充填 (fill) 品目の目標探索。媒体を kind:"fill_medium" で返し work/entity へ接続しない。必ず return し後段の target 自身のブロック走査へ落とさない。
  try {
    const fillDef = fillDefOf(target);
    const fillSources = sources.filter((x) => x && x.kind === "fill");
    if (fillDef && fillSources.length) {
      const dropped = (scan?.items || []).find((x) => itemTypeOf(x) === target);
      if (dropped) return { found: true, kind: "item", loc: { ...dropped.location }, typeId: target, entity: dropped, detail: { state: "present", via: "fill_drop" } };
      const media = fillSources.map((x) => ({ id: x.id, mediumKind: x.mediumKind || fillDef.mediumKind }));
      const blockMedia = media.filter((md) => md.mediumKind === "block");
      if (blockMedia.length) {
        const blockCands = [];
        for (const md of blockMedia) { const loc = scanBlockNear(bot, r, md.id); if (loc) blockCands.push({ loc, typeId: md.id }); else if (noteScanState(md.id)) return { found: false, detail: { state: "unknown" } }; }
        const bp = veinPickNearest(blockCands, bot.location);
        if (bp) { // S5: 溶岩は安全な立ち位置がある候補だけを返す (無い候補は選択時点で外す)
          if (bp.typeId === "minecraft:lava") { const stand = fillSafeStand(bot, bp.loc); if (stand) return { found: true, kind: "fill_medium", loc: bp.loc, typeId: bp.typeId, fillItem: target, mediumKind: "block", entity: null, stand, detail: { state: "present", via: "fill_scan" } }; }
          else return { found: true, kind: "fill_medium", loc: bp.loc, typeId: bp.typeId, fillItem: target, mediumKind: "block", entity: null, detail: { state: "present", via: "fill_scan" } };
        }
        const sv = lookupSurvey(bot, blockMedia.map((md) => md.id), Date.now() < (r.mBanUntil || 0) ? r.mBanKey : null);
        if (sv) { if (sv.typeId === "minecraft:lava") { const stand = fillSafeStand(bot, sv.loc); if (stand) return { found: true, kind: "fill_medium", loc: sv.loc, typeId: sv.typeId, fillItem: target, mediumKind: "block", entity: null, stand, detail: { state: "present", via: "fill_survey" } }; } else return { found: true, kind: "fill_medium", loc: sv.loc, typeId: sv.typeId, fillItem: target, mediumKind: "block", entity: null, detail: { state: "present", via: "fill_survey" } }; }
        return { found: false, detail: { state: "absent" } };
      }
      const mediaIds = media.map((md) => md.id);
      const animalCands = (scan?.animals || []).filter((e) => e && mediaIds.includes(e.typeId)).map((e) => ({ id: e.id, typeId: e.typeId, loc: { x: e.location.x, y: e.location.y, z: e.location.z }, entity: e }));
      const pick = selectFillMedium({ def: fillDef, mediaIds, animals: animalCands, selfPos: bot.location, banKey: r.mBanKey, banUntil: r.mBanUntil, now: Date.now() });
      if (pick) { const hit = animalCands.find((c) => c.id === pick.entityId); if (hit) return { found: true, kind: "fill_medium", loc: hit.loc, typeId: hit.typeId, fillItem: target, mediumKind: "entity", entity: hit.entity, detail: { state: "present", via: "fill_animals" } }; }
      if (scanUnknown) return { found: false, detail: { state: "unknown" } };
      return { found: false, detail: { state: "absent" } };
    }
  } catch {}
  // 0-D1 (cycle1400): 継続中の鉱脈があれば survey/遠方より優先する (実在を再確認し、消えた候補は捨てる)
  try { if (Array.isArray(r.veinCands) && r.veinCands.length && sources.some((s) => s.kind === "block")) { const live = []; for (const c of r.veinCands) { let t = null; try { t = bot.dimension.getBlock(c.loc)?.typeId || null; } catch {} if (t && veinSameResource(t, c.typeId) && sources.some((s) => s.kind === "block" && veinSameResource(s.id, t))) live.push({ loc: c.loc, typeId: t }); else if (!t) live.push(c); } const liveB = filterBanned(live, r.mBanKey, r.mBanUntil, Date.now());
  r.veinCands = liveB.filter((c) => { try { return bot.dimension.getBlock(c.loc)?.typeId; } catch { return true; } }); // cyc2232 A02 (0-D1): 書き戻しは workBan を含めない (短期 ban 失効後に鉱脈片側を再提示するため)
  const veinSel = r.workBan ? filterWorkBanned(liveB, r.workBan, Date.now()) : liveB; // cyc2232 A02: workBan 未生成時は fail-closed で vein が全滅する回帰の是正 (呼出側ガード)
  const vp = veinPickNearest(veinSel.filter((c) => { try { return !!bot.dimension.getBlock(c.loc)?.typeId; } catch { return false; } }), bot.location);
  if (vp) return { found: true, kind: "block", loc: vp.loc, typeId: vp.typeId, detail: { state: "present", via: "vein" } }; } } catch {}
  { // 0-D1: block 候補は登録順でなく距離優先 (通常/深層は同一資源として横断比較する)
    const blockCands = [];
    for (const s of sources) { if (s.kind !== "block") continue; const loc = scanBlockNear(bot, r, s.id); if (loc) blockCands.push({ loc, typeId: s.id }); else if (noteScanState(s.id)) return { found: false, detail: { state: "unknown" } }; }
    const bp = veinPickNearest(blockCands, bot.location); if (bp) return { found: true, kind: "block", loc: bp.loc, typeId: bp.typeId, detail: { state: "present" } };
  }
  for (const s of sources) {
    if (s.kind === "block") { continue; }
    else if (s.kind === "entity") { const e = nearestEntityOfType([...(scan?.hostiles || []), ...(scan?.animals || [])], s.id, bot.location); if (e) return { found: true, kind: "entity", loc: { ...e.location }, typeId: target, entity: e, detail: { state: "present" } }; if (scanUnknown) anyUnknown = true; }
    else if (s.kind === "craft") {
      const loc = scanBlockNear(bot, r, s.id); if (loc) return { found: true, kind: "block", loc, typeId: s.id, detail: { state: "present" } }; if (noteScanState(s.id)) return { found: false, detail: { state: "unknown" } };
      const it = (scan?.items || []).find((x) => itemTypeOf(x) === s.id); if (it) return { found: true, kind: "item", loc: { ...it.location }, typeId: s.id, entity: it, detail: { state: "present" } };
    }
  }
  { const blockIds = sources.filter((s) => s.kind === "block" || s.kind === "craft").map((s) => s.id); // v0.4.66: 近くに無ければチャンク調査の結果 (地下の鉱石も)
    if (blockIds.length && !anyUnknown) { const sv = lookupSurvey(bot, blockIds, Date.now() < (r.mBanUntil || 0) ? r.mBanKey : null); if (sv) return { found: true, kind: "block", loc: sv.loc, typeId: sv.typeId, detail: { state: "present", via: "survey" } }; } }
  if (target && target.includes(":")) { const loc = scanBlockNear(bot, r, target); if (loc) return { found: true, kind: "block", loc, typeId: target, detail: { state: "present" } }; if (noteScanState(target)) return { found: false, detail: { state: "unknown" } }; }
  if (anyUnknown) return { found: false, detail: { state: "unknown" } }; // R3 防御層: 将来の走査地点追加でもドロップ候補へ unknown を素通りさせない
  const dropId = sources[0]?.dropItem;
  const cand = (scan?.items || []).find((x) => { const tid = itemTypeOf(x); return tid === target || (dropId && tid === dropId); });
  if (cand) return { found: true, kind: "item", loc: { ...cand.location }, typeId: target, entity: cand, detail: { state: "present" } };
  return { found: false, detail: { state: anyUnknown ? "unknown" : "absent" } };
}
function zapEntity(bot, r, e) {
  const core = equipCoreOf(bot, r);
  const d = dist(bot.location, e.location);
  // 銃装備時は射程内なら射撃（連射間隔・装弾・命中は中核側が管理する）
  if (core) {
    let snap = null; try { snap = core.snapshot(); } catch {}
    if (snap && snap.hasGun && d <= snap.gunRange && d >= 2) {
      try { const sr = core.shootAt({ distance: d, applyDamage: (amt) => e.applyDamage(amt, { cause: "projectile", damagingEntity: bot }) }); r.lastAttack = { ok: !!sr?.ok, reason: sr?.reason || null, at: Date.now() }; try { const norm = fromEquipmentResult(sr, "shootAt"); commitLastAction(r, { act: "ATTACK", ok: !!norm?.ok, reason: norm?.ok ? null : (norm?.reason || null), item: null, at: Date.now() }); } catch {} if (sr?.ok) { try { sfxAttack(bot.dimension, bot.location); } catch {} } } catch {} // Phase2: ATTACK結果の回収（記録のみ）/ 6-ML ATTACK commit (cyc1939): 銃の小文字 reason は契約語彙へ正規化してから記録する (記録のみ・分岐不変) / POLISH-SND-ATTACK-01 (cycle0841): 射撃成功時のみ攻撃音 (表示層のみ・実機確認待ち)
      return;
    }
  }
  if (Date.now() - (r.zapAt || 0) <= 900) return;
  r.zapAt = Date.now();
  const dmg = core ? core.weaponDamage().damage : 2; // 装備中核の武器ダメージ表（素手2。フォールバックも表と一致させる v0.4.88）
  let meleeOk = true; try { e.applyDamage(dmg, { cause: "entityAttack", damagingEntity: bot }); } catch { meleeOk = false; }
  try { commitLastAction(r, { act: "ATTACK", ok: meleeOk, reason: meleeOk ? null : "DAMAGE_REJECTED", item: null, at: Date.now() }); } catch {} // 6-ML ATTACK commit (cyc1939): 近接も result 軸へ記録する (記録のみ・分岐不変。applyDamage の例外は失敗として分離し、item は null 固定)
  try { sfxAttack(bot.dimension, bot.location); } catch {} // POLISH-SND-ATTACK-01 (cycle0841): 近接攻撃音 (表示層のみ・実機確認待ち)
}
function pickupItemEntity(bot, owner, itemEnt, ctx) {
  const r = rt(bot);
  const cont = invOf(bot); let stack = null; try { stack = itemEnt.getComponent("minecraft:item")?.itemStack; } catch {}
  if (!cont || !stack) { recordTake(r, "pickupItemEntity", { ok: false, reason: cont ? "ITEM_NOT_FOUND" : "TARGET_UNKNOWN", item: stack?.typeId || null }); return; }
  if (r.takeBan && isTakeBanned(r.takeBan, itemEnt.id, stack?.typeId, Date.now())) return; // TR2136-01 (cycle2200): 固定対象 (ミッション等) の入口ガード。recordTake も呼ばない
  const rest = cont.addItem(stack);
  if (!rest) { try { itemEnt.remove(); } catch {} const st = stats(bot); st.pickup = (st.pickup || 0) + stack.amount; saveStats(bot, st); recordTake(r, "pickupItemEntity", { ok: true, taken: stack.amount, item: stack.typeId }); noteInspectPickup(bot, r, ctx, stack.typeId); try { if (!r.sfxState) r.sfxState = createSfxState(); sfxPickup(r.sfxState, bot.dimension, bot.location, Date.now()); } catch {} } // POLISH-SND-PICKUP-01 (cycle0710): 回収音 (表示層のみ・実機確認待ち)
  else if (rest.amount < stack.amount) { try { itemEnt.remove(); bot.dimension.spawnItem(rest, itemEnt.location); } catch {} recordTake(r, "pickupItemEntity", { ok: true, taken: stack.amount - rest.amount, partial: true, item: stack.typeId }); }
  else { recordTake(r, "pickupItemEntity", { ok: false, reason: "INVENTORY_FULL", item: stack.typeId }); noteTakeFull(bot, r, String(itemEnt.id) + ":" + stack.typeId, stack.typeId); noteTakeBan(r, itemEnt.id, stack.typeId); }
}
// 0-C4 R-C4-1 reader (cyc2375): 保持だけされていた道具指定 (mo.tool) を実行へ接続する。
// equip/already はここで適用し、procure/clarify は呼び出し側 (startMission) が開始可否を決める。
// 装備適用は既存 equipCore に寄せ、適用後に getEquipped で実測確認する。失敗しても仕事自体は落とさない。
function applyRequestedTool(bot, owner, r, tool) {
  let res = null;
  try {
    const itemId = toolItemIdOf(tool);
    if (!itemId) return null;
    let equipped = null;
    try { equipped = equipCoreOf(bot, r)?.getEquipped("Mainhand")?.typeId || null; } catch {}
    const inv = countInv(bot);
    let feasible = false;
    if (equipped !== itemId && !(inv[itemId] > 0)) {
      try { const pl = planLongTask({ target: itemId, amount: 1 }, inv, invDurabilityOf(bot)); feasible = !!(pl && pl.feasible); } catch {}
    }
    res = resolveRequestedTool({ tool, invCounts: inv, equippedMainhand: equipped, feasible });
    if (res.action === "equip") {
      let okEq = false;
      try {
        const core = equipCoreOf(bot, r);
        const sr = core?.setEquip("Mainhand", { typeId: res.itemId, amount: 1 });
        okEq = !!(sr && sr.ok);
        if (okEq) { try { core.refresh(); } catch {} try { okEq = core.getEquipped("Mainhand")?.typeId === res.itemId; } catch { okEq = false; } } // RG U2 (cyc2393): RG-3 V3 実測化。同一内部状態の同値確認でなく、refresh で実コンポーネントから読み直してから装備を実測する
      } catch { okEq = false; }
      r.lastToolRequest = { itemId: res.itemId, action: "equip", ok: okEq, at: Date.now() };
      if (okEq) r.toolUseNote = `${nameOfItem(res.itemId)}でやります。`;
      return res;
    }
    r.lastToolRequest = { itemId: res.itemId, action: res.action, ok: res.action === "already", at: Date.now() };
  } catch {}
  return res;
}
function startMission(bot, owner, r, mo, announce = true, opts = {}) {
  // Phase5 読み手R1 (cycle2006): セッション禁止を入口でマージする。主対象自体が禁止なら leg でない注文は立てない (legsOnly は decomposer 側の完全一致除外に任せる)
  const baseFb579 = Array.isArray(mo.constraints?.forbiddenTargets) ? [...mo.constraints.forbiddenTargets] : []; // v0.5.79: 注文由来の禁止 (base) を merge 前に固定。セッション由来分は毎tick再計算で出し入れする
  try { const mg = mergeSessionForbids(r.sessionForbids, mo); if (mg.mo) mo = mg.mo; if (mg.blocked) { if (announce || mo.legsOnly) say(owner, bot, `その対象は、しないと約束しています。${nameOfItem(mo.target)}は対象にしません`, true); return null; } } catch {} // cycle0117 G2: legsOnly も入口で止める (出口は呼び出し側A/Bに配線済み)
  // 0-C2 reader (cycle1455): allowOnly was stored but never read; gate non-leg hunt/gather missions to the allowed target only (legs are means, not targets).
  try { if (!mo.legsOnly && r.allowOnly && mo.target && (mo.kind === "hunt" || mo.kind === "gather")) { const tid1455 = typeof mo.target === "string" ? mo.target : (mo.target?.item || mo.target?.block || mo.target?.entity || null); if (tid1455 && !isAllowedByAllowOnly(r.allowOnly, tid1455, mo.kind)) { if (announce) say(owner, bot, `その対象は対象外です。許可されている対象だけにします`, true); return null; } } if (!mo.legsOnly && r.allowOnly && Array.isArray(mo.sideTasks) && mo.sideTasks.length) { const keptSides = mo.sideTasks.filter((st) => { const sid = typeof st?.target === "string" ? st.target : (st?.target?.item || st?.target?.block || st?.target?.entity || null); return !sid || isAllowedByAllowOnly(r.allowOnly, sid, st?.kind || mo.kind); }); if (keptSides.length !== mo.sideTasks.length) mo = { ...mo, sideTasks: keptSides }; } } catch {} // v0.5.79: allowOnly は副目標にも適用する (a16 P1: 主目標だけ許可しても副目標が素通りしていた)
  // 0-C2 R-C2-6 U6-2 (cyc2384): 注文自身の allowOnly (肯定形「Xだけ」) を、この注文限りで実効させる。
  // 永続化 (setAllowOnly) はしない: 単発注文の限定を以後の全注文へ効かせるのは過剰なため。
  // 主目標は生成時点で allowOnly と一致するのが前提だが、保持候補の再開等で食い違う場合は入口で止める。
  try { const oao = mo.constraints?.allowOnly; if (!mo.legsOnly && oao?.target && (mo.kind === "hunt" || mo.kind === "gather")) { const otid = typeof mo.target === "string" ? mo.target : (mo.target?.item || mo.target?.block || mo.target?.entity || null); if (otid && !isAllowedByAllowOnly(oao, otid, mo.kind)) { if (announce) say(owner, bot, `その対象は対象外です。許可されている対象だけにします`, true); return null; } if (Array.isArray(mo.sideTasks) && mo.sideTasks.length) { const keptO = mo.sideTasks.filter((st) => { const sid = typeof st?.target === "string" ? st.target : (st?.target?.item || st?.target?.block || st?.target?.entity || null); return !sid || isAllowedByAllowOnly(oao, sid, st?.kind || mo.kind); }); if (keptO.length !== mo.sideTasks.length) mo = { ...mo, sideTasks: keptO }; } } } catch {}
  // 0-C2 読み手 (cycle1337): セッション上限 (r.caps) を mission 制約へ届け、狩猟量を上限で clamp する
  try { const mergedCaps = mergeCaps(mo.constraints?.caps, r.caps); if (mergedCaps.length) { mo = { ...mo, constraints: { ...(mo.constraints || {}), caps: mergedCaps } }; if (mo.kind === "hunt" || mo.kind === "gather") { const cp = capForTarget(mergedCaps, mo.target, mo.kind); if (cp !== null && (mo.amount ?? 1) > cp) mo = { ...mo, amount: cp }; } } } catch {} // cyc2043: 採取 (gather) もセッション上限で clamp (従来は狩猟のみ)
  // 0-C5 R3 (cyc2122): 指示個数の上限10,000をチャット経路にも持たせる (UI経路 parseCount と同じ上限で非対称を解消)。leg は手段であり対象でないため除外。
  try { if (!mo.legsOnly && typeof mo.amount === "number" && Number.isFinite(mo.amount) && mo.amount > 10000) mo = { ...mo, amount: 10000 }; } catch {}
  if (!mo.legsOnly) r.toolPrepTotal = 0; // キュー0副次 R1 (cycle1421): 道具準備の通算上限は新規注文ごとに数え直す (leg 子ミッションでは消さない)
  // 0-C4 RG-2 (cyc2377): 道具指定の clarify 判定は長期タスク分岐より前に置く。従来は plan が立つ注文が
  // 分岐へ先に吸われ、未所持・作製不能でも黙って開始していた (ゲートは分岐の後ろにしか無かった)。
  // ここでは clarify のみを判定し、equip/already/procure は従来経路 (分岐後ゲート/startLongTask) に任せる。
  if (!mo.legsOnly && mo.tool) {
    try {
      const tidGate = toolItemIdOf(mo.tool);
      if (tidGate) {
        let eqGate = null; try { eqGate = equipCoreOf(bot, r)?.getEquipped("Mainhand")?.typeId || null; } catch {}
        const invGate = countInv(bot);
        if (eqGate !== tidGate && !(invGate[tidGate] > 0)) {
          let feasGate = false; try { const plGate = planLongTask({ target: tidGate, amount: 1 }, invGate, invDurabilityOf(bot)); feasGate = !!(plGate && plGate.feasible); } catch {}
          if (!feasGate) { if (announce && owner) say(owner, bot, `${nameOfItem(tidGate)}は持っていなくて、今は作れません。別の道具でよければ言ってください`, true); return null; }
        }
      }
    } catch {}
  }
  // 工程（クラフト/精錬/ツール自作）が要る注文は、長期自律タスクとして自分で手段を組み立てる
  if (!opts.noLongTask && !mo.legsOnly) {
    let ltPlan = null;
    try { ltPlan = planLongTask(mo, countInv(bot), invDurabilityOf(bot)); } catch { ltPlan = null; }
    // v0.4.67: 計画処理は ID によって minecraft: が無いと失敗する (stone_axe 等)。読み取り側は付けないので付けて再試行
    if (!(ltPlan && ltPlan.feasible) && typeof mo.target === "string" && !mo.target.includes(":")) { try { const p2 = planLongTask({ ...mo, target: "minecraft:" + mo.target }, countInv(bot), invDurabilityOf(bot)); if (p2 && p2.feasible) { ltPlan = p2; mo = { ...mo, target: "minecraft:" + mo.target }; } } catch {} }
    if (ltPlan && ltPlan.feasible) { try { mo.baseForbiddenTargets = baseFb579; } catch {} startLongTask(bot, owner, r, mo, ltPlan, announce); return null; }
  }
  // 0-C4 R-C4-1 reader (cyc2375): 道具指定の開始ゲート。未所持・作製不能なら黙って別道具で始めず明示して開始しない。
  // 未所持・作製可能なら指定道具の調達を先行させ、完了後に本来の注文へつなぐ (pendingAfterTool、finishMission/completeLongTask で消費)。
  if (!mo.legsOnly && mo.tool) {
    const tr = applyRequestedTool(bot, owner, r, mo.tool);
    if (tr && tr.action === "clarify") { if (announce && owner) say(owner, bot, `${nameOfItem(tr.itemId)}は持っていなくて、今は作れません。別の道具でよければ言ってください`, true); return null; }
    if (tr && tr.action === "procure") {
      if (announce && owner) say(owner, bot, `${nameOfItem(tr.itemId)}を持っていないので、先に用意します`, true);
      r.pendingAfterTool = mo;
      savePendingTool(bot, r); // RG U3 (cyc2394): 設定と同時に DP へ保存する (再読込で本来注文が無言消失しない)
      startMission(bot, owner, r, { kind: "gather", target: tr.itemId, amount: 1, constraints: { hostiles: "avoid", forbiddenTargets: [] }, sideTasks: [], returnTo: "owner", name: null, tool: null, placement: null }, false);
      return null;
    }
  }
  const m = createMission(mo, null);
  try { m.baseForbiddenTargets = baseFb579.map((x) => normForbiddenId(x)).filter((x) => typeof x === "string" && x); } catch {} // v0.5.79: base を mission 本体へ保持 (persistMission の JSON に同梱される)
  try { r.requestedTool = mo.tool ?? null; } catch {} // 0-C4 (cyc2020): 道具指定を実行側の参照点として保持する (mission.order.tool と二重に残し、装備選択の読み手が参照できるようにする)
  r.mission = m; r.missionKills = 0; r.suspendNotified = false; r.mFound = false; r.sideTask = null; r.veinCands = []; r.treeCands = []; // 0-D1: 鉱脈候補は mission 単位 (前 mission の残りを持ち越さない) / 0-D3 R1: 木候補も同様
  // POLISH-ANIM-ORDERLOOK-01 feeder: 指示受理の辺で一度だけ発火を記録する (表示層のみ・実機確認待ち)
  try { if (announce && owner) { if (!r.orderlookState) r.orderlookState = createOrderLookState(); const oo = noteOrderAccepted(r.orderlookState, { nowMs: Date.now(), dist: dist(bot.location, owner.location), suppressed: false, danger: false, falling: r.selfFalling === true }); r.orderlookState = oo.state; if (oo.fired) r.lastOrderLook = { at: Date.now() }; } } catch {}
  r.withdrawBlocked = new Set(); r.withdrawCooldownUntil = 0; r.withdrawTargetKey = null; // Phase2 WITHDRAW Step B: 試行済み情報は mission 単位で初期化
  persistMission(bot, r, true);
  dps(bot, "cb_order", JSON.stringify({ ...mo, startedAt: Date.now() }));
  if (announce) {
    const plan = planFor(mo.target, { count: mo.amount });
    const h = mo.constraints?.hostiles;
    const ht = h === "ignore" ? "敵は無視して進みます。" : h === "fight" ? "敵は倒しながら行きます。" : "敵は避けて通ります。";
    const sides = (mo.sideTasks || []).map((s) => nameOfItem(s.target)).join("、");
    let line = `承知しました。${nameOfItem(mo.target)}を${mo.amount}個、集めます。${ht}${sides ? `途中で${sides}も集めながら行きます。` : ""}${mo.returnTo === "home" ? "集めたら拠点へ入庫します。" : ""}`;
    if (r.toolUseNote) { line += r.toolUseNote; r.toolUseNote = null; } // R-C4-1: 指定道具を装備できた場合のみ受理発話へ足す
    if (plan?.support === "gather_only") line += "精錬の工程は未対応です。原料の回収まで行います。";
    if (plan?.support === "unsupported") line += "……その素材は、私では採取できません。別の方法を考えてください。";
    say(owner, bot, line, true);
  }
  return m;
}
// Phase3 stale是正 F2 (v0.4.22, cycle1301 A05/A16): ミッション終了・差替時に計画系レコードを無効化する。残留した allow を将来の読み手が使う事故を防ぐ (記録の掃除のみ、分岐には使わない)。
function clearPlanRecords(r) { try { r.planRunner?.cancelCurrent("superseded"); } catch {} try { r.toolNeed = null; r.lastPlan = null; r.lastPlanGate = null; r.lastPlanGateP3 = null; r.lastPlanRevalP4 = null; r.lastPlanGateUnified = null; r.lastPlanRevalFull = null; r.lastPlanRevalAdopt = null; r.lastPlanRevalFullAdopt = null; r.lastPlanGateUnifiedAdopt = null; r.lastGoal = null; r.lastPlanInspect = null; r.lastPlanAt = 0; r.planAdoptSeen = null; r.planAdoptShieldUsedFor = null; r.lastPlanAdoptEffect = null; r.tracePlanSeen = null; r.traceActSeen = null; } catch {} }
function finishMission(bot, owner, r) {
  r.mission = null; clearPlanRecords(r);
  try { r.requestedTool = null; r.toolAppliedLegIdx = null; } catch {} // R-C4-1: 道具指定は mission 単位。残留を仕様にしない / RG-6 (cyc2377): leg 適用印も同様
  // 0-C4 R-C4-1 (cyc2375): 先行調達した指定道具が揃ったら、本来の注文を開始する (揃わなければ繋がない)
  try {
    if (r.pendingAfterTool && owner) {
      const next = r.pendingAfterTool; r.pendingAfterTool = null; savePendingTool(bot, r); // RG U3: 消費したら DP も消す
      const tid = toolItemIdOf(next.tool);
      let haveTool = false;
      try { haveTool = !!tid && ((countInv(bot)[tid] || 0) > 0 || equipCoreOf(bot, r)?.getEquipped("Mainhand")?.typeId === tid); } catch {}
      if (haveTool) { startMission(bot, owner, r, next); return; }
      r.lastToolRequest = { itemId: tid, action: "procure", ok: false, at: Date.now() };
      try { say(owner, bot, `${tid ? nameOfItem(tid) : "指定の道具"}が用意できなかったため、先ほどの指示は始められませんでした`, true); } catch {} // RG-5 U1 (cyc2392): 無言消失の是正。破棄の事実を明示する
    }
  } catch {}
  // 0-F2 (cyc2003): 防具一式の残り部位があれば次を開始する (完了した部位は再開しない)
  try {
    if (Array.isArray(r.pendingGearSet) && r.pendingGearSet.length && owner) {
      const next = r.pendingGearSet.shift();
      if (!r.pendingGearSet.length) r.pendingGearSet = null;
      savePendingGearSet(bot, r); // 0-F R-2 (cyc2379): 消費後の残りを保存し直す (再読込で残りが消えない)
      startMission(bot, owner, r, { kind: "gather", target: next, amount: 1, constraints: { hostiles: "avoid", forbiddenTargets: [] }, sideTasks: [], returnTo: "owner", name: null, tool: null, placement: null });
      persistMission(bot, r, true);
      return;
    }
  } catch {}
  persistMission(bot, r, true);
  dps(bot, "cb_order", "");
  if (r.buildPlan && r.buildPlan.stage === "gather") advanceBuildGather(bot, owner, r);
}
// BLD1621-04 (cycle1640): gather 中の集めミッションが完了以外の形で消えた時に buildPlan を畳む (孤児化防止)。同一性確認つき。
function foldGatherBuildPlan(bot, owner, r, reason, dyingMission) {
  const bp = r.buildPlan; if (!bp || bp.stage !== "gather") return false;
  const miss = bp.missing?.[bp.missingIdx];
  if (dyingMission) { const o = dyingMission.order; if (!o || o.legsOnly !== true || !miss || o.target !== miss.item) return false; }
  try { say(owner, bot, `建築を中断しました。${bp.name}の材料、${miss ? nameOfItem(miss.item) : "材料"}が集めきれませんでした`, true); } catch {}
  try { noteFail(bot, "place:build_gather_folded", new Error(`build gather folded: reason=${reason} missingIdx=${bp.missingIdx}/${bp.missing?.length ?? 0} item=${miss?.item ?? "?"}`)); } catch {}
  r.buildPlan = null;
  r.buildStallKey = null; r.buildStallSince = 0; r.buildStallBest = null; r.buildDangerSince = null; r.buildDangerNoted = false; r.buildDimSince = null; r.buildDimNoted = false; r.buildProgressAt = null; r.buildProgressIdx = null; r.buildProgressPlaced = null; r.buildUnknownSince = null; r.buildUnknownNoted = false;
  return true;
}

// ---------- v0.4.0: 長期自律タスク ----------
function lname(item) { return item === "group:logs" ? "原木" : item === "group:planks" ? "板材" : item === "group:cobble" ? "丸石" : nameOfItem(item); }
function saveLongTask(bot, r) { dps(bot, "cb_longtask", r.longtask ? JSON.stringify(r.longtask) : ""); }
// 倉庫 W1: 台帳の保存はこの1点だけを通す (登録・除外・行き先の変更は台帳を差し替えた後に呼ぶ)
function saveWarehouse(bot, r) { try { if (r.warehouse) dps(bot, "cb_warehouse", serializeWarehouseRegistry(r.warehouse)); } catch {} }
// 倉庫 W1 候補スキャン供給 (cycle1514): 新規の世界走査はせず、world_memory が既に知っている
// コンテナ (knownContainers) だけを台帳の候補へ流す。60秒間引き・次元一致・コンテナ種別のみ。
// 登録済み/重複/除外の扱いは純粋核 addCandidates と台帳側が担保する (ここでは再実装しない)。
function refreshWarehouseCandidates(bot, r) {
  try {
    if (!bot || !r || !r.warehouse) return 0;
    const now = Date.now();
    if (now - (r.whCandAt || 0) < 60000) return 0;
    r.whCandAt = now;
    const wm = wmemOf(bot); if (!wm?.knownContainers) return 0;
    const dimId = bot.dimension?.id; if (!dimId) return 0;
    const list = [];
    // a01 §4-E (cycle1514): 除外済み箱の水平隣接セルは候補にしない (ラージチェストの未登録の相方が
    // 単独で登録されると核の除外優先が届かなくなるため、変換層で安全側に倒す)
    const excludedCells = [];
    try { for (const b of r.warehouse.boxes || []) { if (b && b.role === "excluded" && typeof b.key === "string") { const p = b.key.split("|"); const xyz = (p[1] || "").split(",").map(Number); if (p[0] === dimId && xyz.length === 3 && xyz.every(Number.isFinite)) excludedCells.push(xyz); } } } catch {}
    for (const c of wm.knownContainers(dimId) || []) {
      try {
        if (!c || c.dim !== dimId) continue;
        if (c.k && !isContainerBlock(c.k)) continue;
        if (excludedCells.some(([ex, ey, ez]) => ey === Math.floor(c.y) && Math.abs(ex - Math.floor(c.x)) + Math.abs(ez - Math.floor(c.z)) === 1)) continue;
        const key = warehouseKeyOf(c.dim, c.x, c.y, c.z);
        if (key) list.push({ key, dim: c.dim });
      } catch {}
    }
    if (!list.length) return 0;
    const res = addCandidates(r.warehouse, list);
    if (res && res.added > 0) { r.warehouse = res.reg; r.lastWarehouseCandidates = { at: now, added: res.added, total: r.warehouse.candidates.length }; return res.added; }
    return 0;
  } catch { return 0; }
}
function startLongTask(bot, owner, r, mo, plan, announce = true) {
  const ltName = (plan.target.name && !String(plan.target.name).includes(":")) ? plan.target.name : (mo.name || lname(plan.target.item)); // v0.4.67(外部): ID のまま表示しない
  r.longtask = { target: plan.target.item, name: ltName, amount: plan.target.count, legs: plan.legs, legIdx: 0, phase: "legs", returnTo: mo.returnTo || "owner", hostiles: mo.constraints?.hostiles || "avoid", forbiddenTargets: mo.constraints?.forbiddenTargets || [], startedAt: Date.now(), baseForbiddenTargets: Array.isArray(mo.baseForbiddenTargets) ? mo.baseForbiddenTargets : null, tool: mo.tool ?? null, placement: mo.placement ?? null }; // 0-C4 (cyc2020): 長期タスクでも道具指定・設置位置を保持する (従来は脱落していた)
  r.mission = null; clearPlanRecords(r); r.ltLegActive = false; r.mineLeg = null; r.spiral = null;
  try { if (mo.tool) { applyRequestedTool(bot, owner, r, mo.tool); r.toolAppliedLegIdx = 0; } } catch {} // R-C4-1: 長期タスクでも指定道具を装備へ接続する (調達は plan の工程に任せ、ここでは装備のみ) / RG-6 (cyc2377): 開始時適用済みの印を立て、初回 tick での二重適用を防ぐ
  persistMission(bot, r, true); saveLongTask(bot, r);
  dps(bot, "cb_order", JSON.stringify({ ...mo, longtask: true, startedAt: Date.now() }));
  if (announce) { const tn = r.toolUseNote || ""; r.toolUseNote = null; say(owner, bot, `承知しました。${ltName}を${plan.target.count}個ですね。手段は私が組み立てます。全${plan.legs.length}工程、まず「${legLabel(plan.legs[0], lname)}」から始めます。遠くへ行くかもしれませんが、呼び戻せば戻ります${tn ? `。${tn}` : ""}`, true); }
}
function completeLongTask(bot, owner, r, ok = true, note = "", msg = null) {
  const lt = r.longtask;
  if (msg) say(owner, bot, msg, true);
  else if (ok) say(owner, bot, `長期タスク、完了しました。${lt.name}を${lt.amount}個、${lt.returnTo === "home" ? "拠点へ入庫しました" : "お渡ししました"}${note}`, true);
  else say(owner, bot, `長期タスクは揃えたのですが、納品できませんでした。${note}`, true);
  r.longtask = null; r.mineLeg = null; r.spiral = null; r.ltLegActive = false;
  try { r.requestedTool = null; r.toolAppliedLegIdx = null; } catch {} // R-C4-1: 掃除 / RG-6 (cyc2377)
  // 0-C4 R-C4-1 (cyc2375): 指定道具の調達が長期タスクで完了した場合、本来の注文へつなぐ
  try {
    if (ok && r.pendingAfterTool && owner) {
      const next = r.pendingAfterTool; r.pendingAfterTool = null; savePendingTool(bot, r); // RG U3: 消費したら DP も消す
      const tid = toolItemIdOf(next.tool);
      let haveTool = false;
      try { haveTool = !!tid && ((countInv(bot)[tid] || 0) > 0 || equipCoreOf(bot, r)?.getEquipped("Mainhand")?.typeId === tid); } catch {}
      if (haveTool) startMission(bot, owner, r, next);
      else { try { say(owner, bot, `${tid ? nameOfItem(tid) : "指定の道具"}が用意できなかったため、先ほどの指示は始められませんでした`, true); } catch {} } // RG-5 U1 (cyc2392)
    } else if (r.pendingAfterTool) { const _pt = r.pendingAfterTool; r.pendingAfterTool = null; savePendingTool(bot, r); try { const _tid = toolItemIdOf(_pt.tool); say(owner, bot, `${_tid ? nameOfItem(_tid) : "指定の道具"}が用意できなかったため、先ほどの指示は始められませんでした`, true); } catch {} } // RG-5 U1 (cyc2392): 失敗終了時の無言破棄も明示する
  } catch {}
  // GEARSET-CHAIN-LTDEAD-01 (cyc2400): 一式の部位は startMission の長期タスク分岐へ吸われるのが通常経路で、その完了は finishMission でなくここを通る。成功時に限り、道具チェーンが次の作業を開始していない場合のみ残り部位を1つ消費して開始する (finishMission 側の消費と shift 時点確定の作法を揃え、二重前進しない)
  try {
    if (ok && owner && !r.mission && !r.longtask && Array.isArray(r.pendingGearSet) && r.pendingGearSet.length) {
      const next = r.pendingGearSet.shift();
      if (!r.pendingGearSet.length) r.pendingGearSet = null;
      savePendingGearSet(bot, r);
      startMission(bot, owner, r, { kind: "gather", target: next, amount: 1, constraints: { hostiles: "avoid", forbiddenTargets: [] }, sideTasks: [], returnTo: "owner", name: null, tool: null, placement: null });
      persistMission(bot, r, true);
    }
  } catch {}
  saveLongTask(bot, r);
  dps(bot, "cb_order", "");
}
// 工程に要る作業台/かまどを、近くに無ければ所持品から足元へ置く
function pickUpPlacedStation(bot, r) {
  const ps = r.placedStation; if (!ps) return;
  try {
    if (bot.dimension.id !== ps.dim) { r.placedStation = null; return; }
    // 要望バッチA GAP-3 (cycle0821): 到達の原則 — 設置物中心まで 8 を超えたら遠隔回収せず、記録を保持して近づいたときに回収する
    if (dist(bot.location, { x: ps.x + 0.5, y: ps.y + 0.5, z: ps.z + 0.5 }) > 8) return;
    r.placedStation = null;
    const b = bot.dimension.getBlock({ x: ps.x, y: ps.y, z: ps.z });
    if (!b || b.typeId !== ps.id) return;
    if (ps.id === "minecraft:furnace") { const c = b.getComponent("minecraft:inventory")?.container; if (c) for (let i = 0; i < c.size; i++) if (c.getItem(i)) return; } // 中身が残っているかまどは置いたままにする
    b.setType("minecraft:air");
    const bc = invOf(bot); let rest = 1; if (bc) rest = addTo(bc, ps.id, 1);
    if (rest > 0) bot.dimension.spawnItem(new ItemStack(ps.id, rest), bot.location);
  } catch (err) { noteFail(bot, "station:pickup_failed", err); }
}
function ensureStation(bot, r, leg) {
  const need = leg.type === "smelt" ? "minecraft:furnace" : leg.station === "table" ? "minecraft:crafting_table" : null;
  if (!need) return true;
  const pos = bot.location, dim = bot.dimension;
  for (let dx = -4; dx <= 4; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -4; dz <= 4; dz++) {
    let b = null; try { b = dim.getBlock({ x: Math.floor(pos.x) + dx, y: Math.floor(pos.y) + dy, z: Math.floor(pos.z) + dz }); } catch {}
    if (b && b.typeId === need) return true;
  }
  if (!hasItem(bot, need)) return false;
  const fx = Math.floor(pos.x), fy = Math.floor(pos.y), fz = Math.floor(pos.z);
  // v0.4.67: 置き場所は足元の隣 4 マスだけでなく、周囲 5×3×5 の「空いていて足場がある」マスから近い順に探す
  // (トンネルの中では隣 4 マスが全部岩で、作業台を持っていても置けずに長期タスクが中断していた)。自分の体の位置は除く
  const spots = [];
  for (let dy = 1; dy >= -1; dy--) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { // 下り階段のトンネルでは、通ってきたマスは 1 段上
    if (dx === 0 && dz === 0) continue;
    spots.push([dx, dz, dy, Math.abs(dx) + Math.abs(dz) + Math.abs(dy) * 0.5]);
  }
  spots.push([0, 0, 2, 9], [0, 0, -1, 9.5]); // 最後の手段: 頭の上・足元の下
  spots.sort((a, b) => a[3] - b[3]);
  for (const [dx, dz, sdy] of spots) {
    let cell = null, below = null;
    try { cell = dim.getBlock({ x: fx + dx, y: fy + sdy, z: fz + dz }); below = dim.getBlock({ x: fx + dx, y: fy + sdy - 1, z: fz + dz }); } catch {}
    if (cell && below && cell.typeId === "minecraft:air" && below.typeId !== "minecraft:air" && !below.isLiquid) {
      if (!takeFromInv(bot, need, 1)) return false;
      try {
        cell.setType(need);
        let placed = false; try { const rb = dim.getBlock({ x: fx + dx, y: fy + sdy, z: fz + dz }); placed = !!rb && rb.typeId === need; } catch {}
        if (placed) { try { r.lastPlace = { act: "PLACE", mode: "station", ok: true, reason: null, item: need, at: Date.now() }; commitLastAction(r, r.lastPlace); } catch {} try { sfxPlace(dim, { x: fx + dx + 0.5, y: fy + sdy + 0.5, z: fz + dz + 0.5 }, need); } catch {} r.placedStation = { x: fx + dx, y: fy + sdy, z: fz + dz, id: need, dim: dim.id }; return true; } // v0.4.67: 使い終わったら回収する / POLISH-SND-PLACE-01 (v0.4.90): 設置音
        throw new Error("station verify failed");
      } catch (err) {
        // Phase2 PLACE (v0.4.8): 消費後の設置失敗でアイテムを消失させない (ロールバック: インベントリへ戻し、満杯なら足元へ)
        try { const bc = invOf(bot); let rest = 1; if (bc) rest = addTo(bc, need, 1); if (rest > 0) bot.dimension.spawnItem(new ItemStack(need, rest), bot.location); } catch {}
        try { r.lastPlace = { act: "PLACE", mode: "station", ok: false, reason: "SET_FAILED", item: need, at: Date.now() }; commitLastAction(r, r.lastPlace); } catch {}
        noteFail(bot, "place:set_failed", err, {expDone: true});
        return false;
      }
    }
  }
  // v0.4.67: 縦穴やトンネルの中で置き場所が無い時は、横の土・石を 1 マス掘ってそこに置く (掘ったブロックは手持ちへ)
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = { x: fx + dx, y: fy, z: fz + dz };
    let cell = null; try { cell = dim.getBlock(c); } catch {}
    if (!cell || cell.typeId === "minecraft:air" || cell.isLiquid || cell.typeId === "minecraft:bedrock") continue;
    const id = cell.typeId;
    if (/_ore$|ancient_debris/.test(id) || isArtificialId(id) || isContainerBlock(id)) continue; // 鉱石・人工物・入れ物は壊さない
    if (requiredPickLevel(id) > bestPickLevel(bot) || lavaNear(dim, c)) continue;
    // cycle1832 GAP-4 (案B+): carve も掘削ゲートと構造物ガードを通す (従来は無検査で直接置換していた)
    if (structureGuard(dim, c)) continue;
    { let gate = null; try { const eye = { x: pos.x, y: pos.y + 1.6, z: pos.z }; gate = evaluateDig(digBlockAt(bot), eye, c, { reach: WORK_REACH, feetCell: { x: fx, y: fy, z: fz }, via: "work" }); } catch { gate = { action: "hold", why: "gate_error" }; }
      if (!gate || gate.action !== "dig") { r.lastDigHold = { why: gate?.why || "gate_error", loc: { ...c }, at: Date.now() }; continue; } }
    if (!takeFromInv(bot, need, 1)) return false;
    try {
      cell.setType(need);
      { const rb = dim.getBlock(c); if (!rb || rb.typeId !== need) throw new Error("station carve verify failed"); } // cycle1832 F2: 設置後再読込で確認してから keep を付与する
      const keep = id === "minecraft:grass_block" ? "minecraft:dirt" : id === "minecraft:stone" ? "minecraft:cobblestone" : id === "minecraft:deepslate" ? "minecraft:cobbled_deepslate" : id;
      try { const bc = invOf(bot); let rest = 1; if (bc) rest = addTo(bc, keep, 1); if (rest > 0) dim.spawnItem(new ItemStack(keep, rest), bot.location); } catch {}
      r.placedStation = { ...c, id: need, dim: dim.id };
      try { r.lastPlace = { act: "PLACE", mode: "station", ok: true, reason: null, item: need, at: Date.now() }; commitLastAction(r, r.lastPlace); } catch {}
      try { sfxDigBreak(dim, { x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5 }, id); } catch {} // cycle0153: carve で掘った元ブロックの破壊音 (素材は掘削元 id が正)
      try { sfxPlace(dim, { x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5 }, need); } catch {} // POLISH-SND-PLACE-01 (v0.4.90): 設置音 (carve 経路)
      return true;
    } catch (err) { try { const bc = invOf(bot); let rest = 1; if (bc) rest = addTo(bc, need, 1); if (rest > 0) dim.spawnItem(new ItemStack(need, rest), bot.location); } catch {} noteFail(bot, "place:carve_failed", err); return false; }
  }
  return false;
}
// ブランチマイニング：目標深度まで縦穴を掘り、深度では前方を掘り進む。鉱石が見つかれば通常の採取に戻る。
function tickBranchMine(bot, owner, r, ctx) {
  const leg = r.mineLeg; if (!leg) return;
  // キュー7 (cycle1443): survey ヒント方向 (本関数内に置く: digdown E2E ハーネスが本関数を逐語抽出して評価するため)
  const surveyHintDir = () => {
    try {
      const hints = collectHints(surveys, { dimId: bot.dimension?.id, now: Date.now() });
      const ore = hints.filter((h) => h.typeId === leg?.item || /_ore$/.test(h.typeId || ""));
      if (!ore.length) return null;
      const best = chooseHint(bot.location, ore, { depth: leg?.depth });
      if (!best) return null;
      const dir = hintDirection(bot.location, best.loc);
      if (dir) { try { r.lastSurveyHint = { mode: "steer", typeId: best.typeId, loc: best.loc, at: Date.now() }; } catch {} }
      return dir;
    } catch { return null; }
  };
  // キュー7 R1 (cycle2333): ヒント座標を返す版 (surveyHintDir と同じ絞り込み。座標は捨てない)
  // cycle0005 F-2 是正: steerDecision の安全弁 (STEER_RADIUS=64 / 深度帯) を resteer 経路でも課す。
  // cycle0005 F-3 是正: blocked 中は入力 (次元|leg|位置セル) が不変のため結果を3秒キャッシュする (null も含む)。
  const surveyHintLoc = () => {
    try {
      const now = Date.now();
      const cell = `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
      const ckey = `${bot.dimension?.id || ""}|${leg?.item || ""}@${leg?.depth ?? ""}|${cell}`;
      const cache = r.resteerHintCache;
      if (cache && cache.key === ckey && now - (cache.at || 0) < 3000) return cache.loc;
      let loc = null;
      try {
        if (leg?.depth != null && Math.abs(pos.y - leg.depth) > SURVEY_HINT.DEPTH_BAND) loc = null; // pos 側深度帯外は誘導しない (steerDecision の no_depth と同一基準)
        else {
          const hints = collectHints(surveys, { dimId: bot.dimension?.id, now });
          const ore = hints.filter((h) => (h.typeId === leg?.item || /_ore$/.test(h.typeId || "")) && inDepthBand(h.loc, leg?.depth));
          if (ore.length) {
            const best = chooseHint(bot.location, ore, { depth: leg?.depth });
            if (best && !(best.distH > SURVEY_HINT.STEER_RADIUS)) loc = best.loc || null; // 半径外ヒントで遠回りさせない
          }
        }
      } catch { loc = null; }
      try { r.resteerHintCache = { key: ckey, at: now, loc }; } catch {}
      return loc;
    } catch { return null; }
  };
  // キュー7 R1 (cycle2333): 方向転換した直後だけヒントへ寄せ直す。毎tick呼び出し禁止 (blocked 回避を潰すため発火点は2種に限定)
  // cycle0005 F-1 是正: 適用可否は resteer_guard_math の decideResteer が決める (元凶方向への復帰禁止・
  // resteer 復帰後の再 blocked で leg 中無効化・距離/深度ガード)。ガードが deny したら現在の方向 (回転結果) を維持する。
  const applyReSteer = () => {
    try {
      const loc = surveyHintLoc(); if (!loc || !r.mineDir) return;
      const rs = reSteerDir(pos, loc, r.mineDir);
      const lk = legKeyOf(leg);
      if (!r.resteerGuard || r.resteerGuard.legKey !== lk) r.resteerGuard = createGuardState(lk);
      const before = r.mineDir;
      const candidate = rs.changed && rs.dir ? rs.dir : before;
      const dec = decideResteer({ pos, hintLoc: loc, depth: leg?.depth, rotatedDir: before, candidateDir: candidate, state: r.resteerGuard, legKey: lk });
      try { r.lastSurveyHint = { mode: "resteer", changed: !!(dec.apply && dec.dir && (dec.dir.x !== before.x || dec.dir.z !== before.z)), overshoot: !!rs.overshoot, guard: dec.reason, loc, at: Date.now() }; } catch {}
      if (dec.apply && dec.dir && (dec.dir.x !== before.x || dec.dir.z !== before.z)) { r.mineDir = dec.dir; r.resteerGuard = recordResteerApplied(r.resteerGuard, lk, dec.dir, before); }
    } catch {}
  };
  const pos = bot.location, dim = bot.dimension;
  const targetY = leg.depth;
  const digAt = (x, y, z) => {
    let b = null; try { b = dim.getBlock({ x, y, z }); } catch {}
    // INSPECT P0 (v0.4.19): 未読セル (!b / 読み取り例外) は空洞ではない。"unknown" として区別し、降下・前進・掘削の根拠にしない
    if (!b) return "unknown";
    try {
      if (b.typeId === "minecraft:air") return "clear";
      if (b.isLiquid) return "liquid"; // v0.4.56 (外部レビュー指摘4): 液体を「空いている」と扱って降りない/進まない
      if (b.typeId === "minecraft:bedrock") return "blocked";
    } catch { return "unknown"; }
    if (startWork(bot, r, { x, y, z, typeId: b.typeId }, { skipAccess: true })) { r.target = { x: x + 0.5, y, z: z + 0.5 }; tickWork(bot, owner, r, ctx); tickWork(bot, owner, r, ctx); tickWork(bot, owner, r, ctx); } // 掘削ペース×3（縦穴・坑道を実用速度で）。v0.4.76 a06 M3: 坑道セル自体が対象なので遮蔽解決はしない
    // cycle0922 キュー0副次 (a02 P0): tickWork が TOOL_INSUFFICIENT で畳んでも無条件に "digging" を返すと、
    // 呼び出し側が同セルを毎 tick 再試行し 30 秒終了保証の対象外で無限ループになる。鮮度つきで伝播させる。
    try { const lb = r.lastBreak; if (lb && lb.reason === "TOOL_INSUFFICIENT" && lb.item === b.typeId && Date.now() - (lb.at || 0) < 2000) return "tool"; } catch {}
    // M-1051-1 (cycle1153): 掘削ゲートの恒常 hold を "digging" に潰すと見切り・終了が一切ない永久滞留になる。
    // 新鮮な lastDigHold が対象セルと一致すれば "held" として伝播し、呼び出し側の30秒累計 (holdHeld) で leg を畳む。
    try { const lh = r.lastDigHold; if (lh && lh.loc && lh.loc.x === x && lh.loc.y === y && lh.loc.z === z && Date.now() - (lh.at || 0) < 2000) return "held"; } catch {}
    return "digging";
  };
  // unknown の保持と終了保証 (cycle1156/a04+a23): その場ホールドを明示し (残留 target の消費を防ぐ)、
  // leg 単位で進捗なし unknown 累計が 30 秒を超えたら mineLeg を畳んで既存の中断経路へ委ねる (復活ループ断ち)。
  const holdUnknown = () => {
    r.target = { x: pos.x, y: pos.y, z: pos.z };
    try {
      const now = Date.now(), key = `${leg.item || ""}@${leg.depth ?? ""}`;
      const cnt = countOfGroup(countInv(bot), leg.item);
      if (!r.branchUnknownLeg || r.branchUnknownLeg.key !== key) r.branchUnknownLeg = { key, totalMs: 0, lastAt: now, count: cnt, noted: false };
      const bu = r.branchUnknownLeg;
      if (cnt > (bu.count || 0)) { bu.totalMs = 0; bu.count = cnt; } // 進捗があれば累計を消す
      if (bu.lastAt && now > bu.lastAt) bu.totalMs += Math.min(now - bu.lastAt, 2000); // cycle0320-a13: cap-add (was discard >=2000ms, 30s cutoff unreachable)
      bu.lastAt = now;
      if (!bu.noted) { bu.noted = true; noteFail(bot, "branchmine:unknown", new Error(key)); }
      if (bu.totalMs > 30000) { noteFail(bot, "branchmine:unknown_exhausted", new Error(key)); r.branchUnknownLeg = null; r.mineLeg = null; r.spiral = null; }
    } catch {}
  };
  // M-1051-1 (cycle1153): hold 側の終了保証 (holdUnknown と同型)。
  // BRANCHHOLD-KEYFLAP 是正 (cycle0224, cycle0153-a15 確定): 累計キーは leg+セル (holdGateHeld と同型)。
  // why は同一セルでも隣接読取の成否や到達境界で揺らぎ、キーに含めると累計が毎回リセットされ30秒見切りが
  // 到達不能になるため、診断用に bh.lastWhy へ保持するだけにする。加算も間隔2000ms以上を丸ごと捨てる形から
  // 1回最大2000msのキャップ加算へ是正 (疎な呼び出しでも前進し、長期不在後の即時枯渇は防ぐ)。
  // 所持数が増えたらリセット。30秒超で leg を畳んで既存の中断経路へ委ねる (方向転換はしない: hold は壁の証拠ではない)。
  const holdHeld = () => {
    r.target = { x: pos.x, y: pos.y, z: pos.z };
    try {
      const now = Date.now(), lh = r.lastDigHold || {};
      const key = `${leg.item || ""}@${leg.depth ?? ""}|${lh.loc ? `${lh.loc.x},${lh.loc.y},${lh.loc.z}` : ""}`;
      const cnt = countOfGroup(countInv(bot), leg.item);
      if (!r.branchHoldLeg || r.branchHoldLeg.key !== key) r.branchHoldLeg = { key, totalMs: 0, lastAt: now, count: cnt, noted: false };
      const bh = r.branchHoldLeg;
      bh.lastWhy = lh.why || null;
      if (cnt > (bh.count || 0)) { bh.totalMs = 0; bh.count = cnt; }
      if (bh.lastAt && now > bh.lastAt) bh.totalMs += Math.min(now - bh.lastAt, 2000);
      bh.lastAt = now;
      if (!bh.noted) { bh.noted = true; noteFail(bot, "branchmine:hold", new Error(key)); }
      if (bh.totalMs > 30000) { noteFail(bot, "branchmine:hold_exhausted", new Error(key)); r.branchHoldLeg = null; r.mineLeg = null; r.spiral = null; }
    } catch {}
  };
  // SPIRAL-GATEHOLD-NOEXIT 是正 (cycle1421, a08実測 F2): 段移動の tunnel ゲート hold には累計時計が無く、
  // ゲート常時 hold で 10,000 tick でも終了0回だった。holdHeld と同型に leg+段セルで累計し、30秒超で leg を畳んで既存の中断経路へ委ねる
  const holdGateHeld = (stepCell) => {
    r.target = { x: pos.x, y: pos.y, z: pos.z };
    try {
      const now = Date.now();
      const key = `${leg.item || ""}@${leg.depth ?? ""}|gate|${stepCell ? `${stepCell.x},${stepCell.y},${stepCell.z}` : ""}`;
      const cnt = countOfGroup(countInv(bot), leg.item);
      if (!r.branchGateLeg || r.branchGateLeg.key !== key) r.branchGateLeg = { key, totalMs: 0, lastAt: now, count: cnt, noted: false };
      const bg = r.branchGateLeg;
      if (cnt > (bg.count || 0)) { bg.totalMs = 0; bg.count = cnt; }
      if (bg.lastAt && now > bg.lastAt) bg.totalMs += Math.min(now - bg.lastAt, 2000); // cycle0320-a13: cap-add (same as holdHeld)
      bg.lastAt = now;
      if (!bg.noted) { bg.noted = true; noteFail(bot, "branchmine:gate_hold", new Error(key)); }
      if (bg.totalMs > 30000) { noteFail(bot, "branchmine:gate_hold_exhausted", new Error(key)); r.branchGateLeg = null; r.mineLeg = null; r.spiral = null; }
    } catch {}
  };
  // SPIRAL F1 是正 (cycle1443, a07実測 390/390 到達不能): 完了分岐は降下ガード (pos.y > targetY+2) の内側にだけあり、
  // k>=total のとき pos.y<=targetY でガードと矛盾して永遠に発火せず、r.spiral が stale 残留していた。
  // ガードの前に完了を判定し、出口 heading を mineDir へ引き継いで螺旋を畳む。
  try {
    const st0 = r.spiral, k0 = `${leg.item || ""}@${leg.depth ?? ""}`;
    if (st0 && st0.key === k0) {
      const lk0 = spiralLocateK(st0, pos), tot0 = spiralStepsTotal(st0);
      if (lk0 != null && lk0 >= tot0) { const h0 = spiralHeading(st0, tot0); r.mineDir = { x: h0[0], z: h0[1] }; r.spiral = null; applyReSteer(); }
    }
  } catch {}
  if (pos.y > targetY + 2) {
    // 螺旋階段 (要望バッチB, v0.4.90): 縦穴＋飛行一気降下を廃し、2×2螺旋を1段ずつ掘って降りる (歩いて戻れる形状)。
    // 幾何は spiral.js (純粋)、掘削は digAt (skipAccess→gateVia "tunnel" で掘削ゲート＋self_support免除)、
    // 移動は tunnelGateDest 経由で、段列を tunnelPath へ積むため帰路は exitTunnelIfNeeded がそのまま使える。
    const sKey = `${leg.item || ""}@${leg.depth ?? ""}`;
    let st = r.spiral;
    if (!st || st.key !== sKey) {
      const wantDir = r.mineDir ? [r.mineDir.x, r.mineDir.z] : (() => { const hd = surveyHintDir(); return hd ? [hd.x, hd.z] : [1, 0]; })(); // キュー7 (cycle1443): 螺旋の出口方向を survey ヒントへ寄せる
      const v = chooseSpiralVariant({ y0: Math.floor(pos.y), targetY, wantDir });
      st = r.spiral = { ...createSpiral({ x: Math.floor(pos.x), z: Math.floor(pos.z), y: Math.floor(pos.y), targetY, chirality: v.chirality, phase: v.phase }), key: sKey };
    } else {
      const lk = spiralLocateK(st, pos);
      if (lk == null) { // 螺旋の外に出ている: 現在セルで再アンカー (交差セルは「既に空＝開通済み」で吸収)
        const wantDir = r.mineDir ? [r.mineDir.x, r.mineDir.z] : (() => { const hd = surveyHintDir(); return hd ? [hd.x, hd.z] : [1, 0]; })(); // キュー7 (cycle1443): 螺旋の出口方向を survey ヒントへ寄せる
        const v = chooseSpiralVariant({ y0: Math.floor(pos.y), targetY, wantDir });
        st = r.spiral = { ...createSpiral({ x: Math.floor(pos.x), z: Math.floor(pos.z), y: Math.floor(pos.y), targetY, chirality: v.chirality, phase: v.phase }), key: sKey };
      } else st.k = lk;
    }
    const total = spiralStepsTotal(st);
    if (st.k >= total) { const h = spiralHeading(st, total); r.mineDir = { x: h[0], z: h[1] }; r.spiral = null; applyReSteer(); /* 到達: この tick は前方掘りへ落とす */ }
    else {
      for (const c of spiralDigCells(st, st.k + 1)) { // 頭上→足元の順 (順序がゲート成立の要)
        if (lavaNear(dim, c)) { r.mineLeg = null; r.spiral = null; r.target = { x: pos.x, y: pos.y, z: pos.z }; return; }
        const res = digAt(c.x, c.y, c.z);
        if (res === "tool") { r.mineLeg = null; r.spiral = null; r.target = { x: pos.x, y: pos.y, z: pos.z }; return; } // cycle0922: 道具不足は方向転換では解けないため leg を畳む (toolNeed は tickWork が記録)
        if (res === "unknown") { holdUnknown(); return; }
        if (res === "held") { holdHeld(); return; } // M-1051-1 (cycle1153)
        if (res === "blocked" || res === "liquid") { r.mineLeg = null; r.spiral = null; r.target = { x: pos.x, y: pos.y, z: pos.z }; return; } // 原点固定の螺旋では方向転換が無意味なため leg を畳み既存中断経路へ
        if (res === "digging") { let bb = null; try { bb = dim.getBlock(c); } catch {} if (!bb || bb.typeId !== "minecraft:air") { r.target = { x: pos.x, y: pos.y, z: pos.z }; return; } } // 掘り切れていない: 次 tick 持ち越し、移動しない
      }
      const step = spiralStepCell(st, st.k + 1);
      const dest = { x: step.x + 0.5, y: step.y, z: step.z + 0.5 };
      const tg = tunnelGateDest(bot, r, dest);
      if (!tg.dest) { holdGateHeld(step); return; } // hold: k を進めない。SPIRAL-GATEHOLD-NOEXIT (cycle1421): 累計30秒で leg を畳む
      if (!r.tunnelPath) r.tunnelPath = [];
      r.tunnelPath.push({ x: pos.x, y: pos.y, z: pos.z }); if (r.tunnelPath.length > 400) r.tunnelPath.shift();
      try { bot.teleport(tg.dest); } catch {}
      r.target = tg.dest; st.k++;
      return;
    }
  }
  // 深度到達：前方2セル（下・上）を掘り進む
  if (!r.mineDir) {
    // キュー7 (cycle1443): 深度帯到達後は survey ヒントへ誘導する (D2形状)。ヒント無し/陳腐/遠方は従来ランダムと完全一致。
    let steered = null;
    try {
      const hints = collectHints(surveys, { dimId: dim?.id, now: Date.now() }).filter((h) => h.typeId === leg.item || /_ore$/.test(h.typeId || ""));
      const dec = steerDecision({ pos, leg, hints, now: Date.now() });
      try { r.lastSurveyHint = { mode: dec.mode, reason: dec.reason || null, typeId: dec.hint?.typeId || null, at: Date.now() }; } catch {}
      if (dec.mode === "steer" && dec.dir) steered = dec.dir;
    } catch {}
    if (steered) r.mineDir = steered;
    else { const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]; const dd = DIRS4[Math.floor(Math.random() * 4)]; r.mineDir = { x: dd[0], z: dd[1] }; }
  } // 基礎 BM-12 (v0.4.65): 方向は4直交のみ。角度の丸めは約1/3で斜めになり、nav の角抜け禁止 (両直交セルの到達可能性が必須) と矛盾して坑道を通れなかった
  const d = r.mineDir, fx = Math.floor(pos.x) + d.x, fz = Math.floor(pos.z) + d.z, fy = Math.floor(pos.y) - 1;
  for (const yy of [fy, fy + 1]) {
    const res = digAt(fx, yy, fz);
    if (res === "tool") { r.mineLeg = null; r.target = { x: pos.x, y: pos.y, z: pos.z }; return; } // cycle0922: 道具不足で leg を畳み無限再試行を断つ
    if (res === "blocked" || res === "liquid") { // cycle0005 F-1 是正: まず blocked をガードへ記録する (元凶方向の保持・再blocked無効化・累計30秒で leg を畳む出口)。その後に回転し、resteer は元凶方向へは戻さない
      try {
        const lk = legKeyOf(leg);
        if (!r.resteerGuard || r.resteerGuard.legKey !== lk) r.resteerGuard = createGuardState(lk);
        const rb = recordBlocked(r.resteerGuard, { legKey: lk, dir: d, kind: res, now: Date.now(), count: countOfGroup(countInv(bot), leg.item) });
        r.resteerGuard = rb.state;
        if (rb.shouldFold) { noteFail(bot, "branchmine:blocked_exhausted", new Error(`${leg.item || ""}@${leg.depth ?? ""}`)); r.resteerGuard = null; r.mineLeg = null; r.target = { x: pos.x, y: pos.y, z: pos.z }; return; }
      } catch {}
      r.mineDir = { x: d.z, z: -d.x }; applyReSteer(); return;
    }
    if (res === "unknown") { holdUnknown(); return; } // 片方でも未読なら前進しない (方向転換もしない: 未読は壁の証拠ではない)
    if (res === "held") { holdHeld(); return; } // M-1051-1 (cycle1153)
    if (res === "digging") return;
  }
  r.target = { x: pos.x + d.x * 3, y: pos.y, z: pos.z + d.z * 3 };
}
// グループ指定 (group:planks 等) を、手持ちの樹種に合わせた具体的な ID にする (計画処理はグループを受け付けない)
function concreteItemOf(item, inv) {
  const held = (suffix) => Object.keys(inv || {}).find((k) => k.endsWith(suffix) && (inv[k] || 0) > 0);
  if (item === "group:planks") { const p = held("_planks"); if (p) return p; const l = held("_log"); if (l) return l.replace(/_log$/, "_planks"); return "minecraft:oak_planks"; }
  if (item === "group:logs") return held("_log") || "minecraft:oak_log";
  if (item === "group:cobble") return "minecraft:cobblestone";
  return item;
}
// queue2 (basics-digdown-dec fix3 + basics-orechain-audit): mineLeg は leg の出自でなく対象の性質で決める。
// findSources の block 源が石系・鉱石系 (stone/deepslate/_ore/ancient_debris) なら潜行対象とする。
// ただし源の dim が現在次元と異なる場合は立てない (quartz/nether_gold_ore 等でオーバーワールド無限坑道化を防ぐ次元ガード)。
function mineLegForLeg(leg, bot) {
  try {
    const curDim = String(bot?.dimension?.id || "");
    const curShort = curDim.includes("nether") ? "nether" : curDim.includes("the_end") || curDim.endsWith(":end") ? "end" : "overworld";
    const dimOk = (d) => !d || d === curShort;
    if (leg?.dim && !dimOk(leg.dim)) return null;
    if (leg?.depth != null) return { depth: leg.depth, item: leg.item };
    const target = (() => { try { return legMissionTarget(leg); } catch { return leg?.item; } })();
    const isStoneOre = (id) => typeof id === "string" && (id === "minecraft:stone" || id === "minecraft:deepslate" || id === "minecraft:ancient_debris" || id.endsWith("_ore"));
    // via が直接石系・鉱石系ならそれも性質として認める (修理フォールバック等で via のみ残るケース)
    const candIds = [];
    try { const e = findSources(target); if (e?.sources) for (const s of e.sources) if (s?.kind === "block") candIds.push(s); } catch {}
    try { const e2 = leg?.item && leg.item !== target ? findSources(leg.item) : null; if (e2?.sources) for (const s of e2.sources) if (s?.kind === "block") candIds.push(s); } catch {}
    for (const s of candIds) { if (isStoneOre(s.id) && dimOk(s.where?.dim || "overworld")) return { depth: Math.floor(bot.location.y) - 4, item: leg.item }; }
    if (leg?.via && isStoneOre(leg.via)) {
      // via の次元は sourcing 源で確認できる場合だけ許可し、不明な nether 系は立てない
      let viaDim = null; try { const ev = findSources(target); const hit = ev?.sources?.find((s) => s.id === leg.via); viaDim = hit?.where?.dim || null; } catch {}
      if (dimOk(viaDim)) return { depth: Math.floor(bot.location.y) - 4, item: leg.item };
    }
    if (leg?.item === "group:cobble") return { depth: Math.floor(bot.location.y) - 4, item: leg.item };
    return null;
  } catch { return null; }
}
// キュー0副次 R1 (cycle1421, a01実測/a02設計A′): 単発ミッション側の toolNeed 消費点。
// 消費ロジックは複写せず、適格な単発 gather ミッションを「再開 leg 1本の合成長期タスク」へ昇格させ、
// toolNeed を残したまま次 tick の tickLongTask 内消費点 (差し込み・上限・終端・発話) へ委ねる。
function tickToolPrepPromote(bot, owner, r) {
  try {
    if (!r.toolNeed) return false;
    // 掃除は lt 側消費点と同一条件 (鮮度300秒 / 充足済み)
    if (Date.now() - (r.toolNeed.at || 0) >= 300000 || bestPickLevel(bot) >= (r.toolNeed.reqLv || 0)) { r.toolNeed = null; return false; }
    const m = r.mission, mo = m?.order;
    // 適格ゲート: 等価な gather leg で表せる単発ミッションだけを昇格する (寄り道・建築・工程子ミッションは親の経路へ委ねる)
    if (!m || m.status !== "active" || !mo || mo.kind !== "gather" || mo.legsOnly) return false;
    if (r.buildPlan) return false;
    if ((r.toolNeed.reqLv || 0) < 1) return false;
    const step = m.steps?.[m.currentStep];
    if (!step || step.type !== "gather_block") return false;
    if ((m.steps || []).some((s) => s.type === "side_collect" && s.status !== "done")) return false;
    const remain = (mo.amount || 0) - (step.have || 0);
    if (remain <= 0) return false;
    const needTotal = countOfGroup(countInv(bot), mo.target) + remain; // leg の need は lt 意味論 (手持ち+不足分、材料不足差し込みの前例)
    const resumeLeg = { type: "gather", item: mo.target, need: needTotal, via: null, yRange: null, depth: mineDepthFor(mo.target), crafts: 0, needs: null, station: null };
    r.longtask = { target: mo.target, name: mo.name || lname(mo.target), amount: mo.amount, legs: [resumeLeg], legIdx: 0, phase: "legs", returnTo: mo.returnTo || "owner", hostiles: mo.constraints?.hostiles || "avoid", forbiddenTargets: mo.constraints?.forbiddenTargets || [], startedAt: m.startedAt || Date.now(), toolRepairs: r.toolPrepTotal || 0, toolPrepFails: r.toolPrepFailTotal || 0 }; // cycle2058: 失敗 streak も昇格を跨いで引き継ぐ
    r.mission = null; r.ltLegActive = false; r.mineLeg = null; r.spiral = null;
    persistMission(bot, r, true); saveLongTask(bot, r);
    // toolNeed は消さない: 次 tick の tickLongTask が既存消費点で道具準備 leg を resumeLeg の前へ差し込む
    return true;
  } catch { return false; }
}
function tickLongTask(bot, owner, r, ctx) {
  const lt = r.longtask; if (!lt) return false;
  // R-C4-1 (cyc2375): leg が切り替わるたびに指定道具の装備を再適用する読み手 (工程中の持ち替えで外れた場合の復帰)
  try { if (lt.tool && r.toolAppliedLegIdx !== lt.legIdx) { r.toolAppliedLegIdx = lt.legIdx; applyRequestedTool(bot, owner, r, lt.tool); if (r.toolUseNote) r.toolUseNote = null; } } catch {}
  let fbIds = Array.isArray(lt.forbiddenTargets) ? [...lt.forbiddenTargets] : []; try { if (!Array.isArray(lt.baseForbiddenTargets)) lt.baseForbiddenTargets = deriveBaseForbiddenIds(lt.forbiddenTargets, r.sessionForbids, "gather"); fbIds = recomputeForbiddenIds(lt.baseForbiddenTargets, r.sessionForbids, "gather"); lt.forbiddenTargets = fbIds; } catch {} // v0.5.79: 和集合の単調増加を置換へ (解除が実行中タスクへ反映される) // cycle0117 G6-b: lt スナップショットと現行セッション禁止の和集合 (開始後の禁止も拾う)。断片ハーネス等で純粋核が無い環境ではスナップショットへ fail-safe
  if (lt.phase === "deliver") {
    // LT-DELIVER-NOEXIT (cycle1322, a01): deliver 相の終了保証。従来は上限が無く、入庫常時失敗/未到達で
    // 毎tick占有し続け cb_longtask 永続化で再起動でも解消しなかった。計数は lt 自体に保持し再起動を跨ぐ。
    // 旧セーブ復元時は遅延初期化する (未初期化の NaN 比較で出口が閉じる同型事故の予防)。
    if (lt.deliverSince == null) { lt.deliverSince = Date.now(); lt.deliverFails = lt.deliverFails || 0; }
    if (Date.now() - lt.deliverSince > LT_DELIVER_TIMEOUT_MS) { noteFail(bot, "longtask:deliver_timeout", new Error(lt.target)); completeLongTask(bot, owner, r, false, "", `長期タスク、ここまでです。${lt.name}は揃えたのですが、お届け先へ辿り着けませんでした`); return true; }
    if (lt.returnTo === "home") {
      const h = homeOf(bot); const rp = h ? { x: h.x + 0.5, y: h.y + 1, z: h.z + 0.5 } : behindOf(owner, 2);
      if (dist(bot.location, rp) <= DELIVER_RANGE) { r.justDeposited = false; doDeliver(bot, owner, r, { order: { returnTo: "home" } }); if (r.justDeposited) { completeLongTask(bot, owner, r); return true; } lt.deliverFails = (lt.deliverFails || 0) + 1; if (lt.deliverFails > LT_DELIVER_FAIL_LIMIT) { noteFail(bot, "longtask:deliver_failed", new Error(lt.target)); completeLongTask(bot, owner, r, false, "", `長期タスク、ここまでです。${lt.name}は揃えたのですが、拠点へ入庫できませんでした。チェストの空きや設置を確認してください`); return true; } saveLongTask(bot, r); return true; } // v0.4.79 B-1+C-2: 入庫実測なしで完了しない。事前クリアで残留フラグの偽完了も防ぐ
      r.target = rp; r.moveAct = "follow"; return true;
    }
    if (owner.dimension.id === bot.dimension.id && dist(bot.location, owner.location) <= DELIVER_RANGE) { // cycle0659 F2 dim gate
      const bc = invOf(bot), oc = invOf(owner);
      let delivered = 0;
      // v0.4.70: 手持ちが足りない (探し尽くしても見つからなかった等) 時は、ある分だけ渡して正しく伝える。
      // 以前は必要数ちょうどを取り出そうとして失敗し、手持ちも渡さず「相手の持ち物がいっぱい」と事実と違う理由を伝えていた
      const have = bc ? countOfGroup(countInv(bot), lt.target) : 0;
      const want = Math.min(have, lt.amount);
      if (bc && oc && want > 0) {
        const used = consumeFrom(bc, lt.target, want);
        const n = used ? Object.values(used).reduce((a, v) => a + v, 0) : 0;
        if (n > 0) { const left = addTo(oc, lt.target, n); delivered = n - left; if (left > 0) addTo(bc, lt.target, left); } // 入らなかった分は自分の手元へ戻す（消さない）
      }
      if (have < lt.amount) {
        if (delivered > 0) completeLongTask(bot, owner, r, true, "", `長期タスク、ここまでです。${lt.name}は${lt.amount}個のうち${delivered}個しか集まらなかったので、その分をお渡ししました`);
        else completeLongTask(bot, owner, r, false, "", `長期タスク、ここまでです。${lt.name}を集めきれませんでした`);
        return true;
      }
      if (delivered >= lt.amount) completeLongTask(bot, owner, r);
      else if (delivered > 0) completeLongTask(bot, owner, r, true, `（${delivered}個だけ渡せました。残りは私が持っています）`);
      else { noteFail(bot, "longtask:deliver_failed", new Error(lt.target)); completeLongTask(bot, owner, r, false, "相手の持ち物がいっぱいのようです"); }
      return true;
    }
    r.target = behindOf(owner, 2); r.moveAct = "follow"; return true;
  }
  // cycle0942 キュー0副次: toolNeed の消費点 (道具準備 leg への移行)。tickWork/branchmine が記録した
  // 道具不足を、station 修理差し込みと同型で「必要等級のツルハシを作る工程」へ変換する。
  // 対象は toolNeed.item 個別ではなく収穫等級だけで決める (汎用)。差し込みは最大3回・工程60件まで。
  if (r.toolNeed && (Date.now() - (r.toolNeed.at || 0) >= 300000 || bestPickLevel(bot) >= (r.toolNeed.reqLv || 0))) r.toolNeed = null; // 鮮度切れ/充足済みは掃除
  if (r.toolNeed) {
    const pickId = pickaxeItemForLevel(r.toolNeed.reqLv || 0);
    // cycle1234 (キュー0副次 R2, a02監査): toolRepairs は差し込み成功時だけ数える
    // (従来は成否判定より前に無条件加算され、上限の意味が弱まっていた)。
    // 上限到達時は station 修理と同型に、理由を述べて長期タスクを中断する終端分岐を持つ
    // (従来は終端が無く、元の leg 再開→再発→再消費の緩いループが残っていた)。
    const toolCapReached = (lt.toolRepairs || 0) >= 3 || lt.legs.length > 60;
    let ins = null;
    if (!toolCapReached) { try { const sub = planLongTask({ target: pickId, amount: 1, constraints: { forbiddenTargets: (typeof fbIds !== "undefined" ? fbIds : []) } }, countInv(bot), invDurabilityOf(bot)); if (sub && sub.feasible && sub.legs && sub.legs.length) ins = sub.legs; } catch {} }
    r.toolNeed = null; // 成否どちらでも消費する (同じ不足で毎tick差し込み続けない)
    if (!ins && toolCapReached) {
      say(owner, bot, `長期タスクを中断しました。ツルハシを用意できませんでした`, true); r.longtask = null; saveLongTask(bot, r); return true;
    }
    if (ins) {
      lt.toolPrepFails = 0; r.toolPrepFailTotal = 0; // 成功で streak を解消する
      lt.toolRepairs = (lt.toolRepairs || 0) + 1;
      r.toolPrepTotal = Math.max(r.toolPrepTotal || 0, lt.toolRepairs); // キュー0副次 R1 (cycle1421): 昇格を跨いでも通算上限が効くよう鏡写しする (追加のみ)
      if (r.mission) { r.mission = null; clearPlanRecords(r); persistMission(bot, r, true); }
      r.ltLegActive = false; r.mineLeg = null; r.spiral = null;
      lt.legs.splice(lt.legIdx, 0, ...ins);
      saveLongTask(bot, r);
      say(owner, bot, `ツルハシが足りません。${nameOfItem(pickId)}を用意してから続けます`, true);
      return false;
    }
    // cycle2058 (toolNeed無出口, a01実測/a02設計): !ins の繰り返しでは toolRepairs も legs も増えず上限到達不能だった (5,000サイクル中断0回)。
    // 失敗専用カウンタ lt.toolPrepFails (成功側へ混ぜない) を3回で終端へ合流させる。鏡 r.toolPrepFailTotal は streak ゆえ代入で揃える。
    lt.toolPrepFails = (lt.toolPrepFails || 0) + 1; r.toolPrepFailTotal = lt.toolPrepFails;
    if (lt.toolPrepFails >= 3) {
      noteFail(bot, "longtask:tool_prep_exhausted", new Error(pickId));
      say(owner, bot, `長期タスクを中断しました。${nameOfItem(pickId)}を用意する手順が、3回続けて組み立てられませんでした`, true);
      if (r.mission) { r.mission = null; clearPlanRecords(r); persistMission(bot, r, true); }
      r.ltLegActive = false; r.mineLeg = null; r.spiral = null; r.longtask = null; saveLongTask(bot, r); return true;
    }
    saveLongTask(bot, r);
  }
  if (r.mission) {
    if (r.mission.status === "done") { r.mission = null; clearPlanRecords(r); persistMission(bot, r, true); }
    else if (r.mission.status === "suspended") {
      // RR-05 (cycle1303): cannot_recover は集約ヘルパー tickSuspendedResume が担う (回復待ち→実測再開→期限切れ)。
      // mineLeg の有無で再開可否を決めない (leg の出自でなく mission の回復状態が性質)。expired のときだけ下の終端へ落とす
      if (r.mission.suspendReason === "cannot_recover" || r.mission.suspendReason === "inv_unreadable") {
        const sres = tickSuspendedResume(bot, r);
        if (sres === "waiting") return true;
        if (sres === "resumed") return false;
      } else {
        // cycle0033 F1: mineLeg resume is gated by f1ResumeDecision (progress-less resumes are cut off)
        // LT-SUSPEND 是正 (cycle1532, A01 実測確定): mineLeg は揮発性で DP 復元されず、再計算点 (leg 開始時) は
        // suspended 分岐より後ろにあるため、再起動後は r.mineLeg===null のまま再開ゲートで落ちて即終端していた。
        // cannot_recover と同じく「再開可否を mineLeg の有無で決めない」形へ揃え、判定は F1 (進捗なし再開の打ち切り) のみで行う。
        // mineLeg は再開時に現在 leg から再計算して潜行の継続に使う。
        if (!r.mineLeg) { try { const cl = r.longtask?.legs?.[r.longtask.legIdx]; if (cl) r.mineLeg = mineLegForLeg(cl, bot); } catch {} }
        if (f1ResumeDecision(bot, r) === "terminate") { noteFail(bot, "longtask:suspend_no_progress_exhausted", new Error(`${r.mission.suspendReason || ""}:${r.mission.suspendCount || 0}`)); }
        else { r.mission.status = "active"; r.mission.suspendReason = null; persistMission(bot, r, true); return false; }
      }
      { say(owner, bot, `長期タスクを中断しました。${SUSPEND_JP[r.mission.suspendReason] || "進めなくなりました"}`, true); r.mission = null; clearPlanRecords(r); persistMission(bot, r, true); r.longtask = null; r.mineLeg = null; r.spiral = null; saveLongTask(bot, r); return true; }
    }
    else return false; // 実行中は tickMission に任せる
  }
  if (r.ltLegActive && !r.mission) { r.ltLegActive = false; r.mineLeg = null; r.spiral = null; lt.legIdx++; saveLongTask(bot, r); } // leg はミッションが終了したときだけ消費する (不変条件の明示、cycle0238-a01 実測で現行挙動と完全一致)
  let guard = 0;
  while (lt.legIdx < lt.legs.length && guard++ < 40) {
    const leg = lt.legs[lt.legIdx];
    if (leg.type === "gather" || leg.type === "hunt") {
      const remain = (leg.need || 1) - countOfGroup(countInv(bot), leg.item);
      if (remain <= 0) { lt.legIdx++; continue; }
      // 丸石は地表に露出していないことが多いので、少し潜って掘る。鉱石は素材ごとの目標深度へ。
      r.mineLeg = mineLegForLeg(leg, bot); r.mineDir = null; // queue2: 性質判定+次元ガードは mineLegForLeg へ集約 (旧3分岐の group:cobble / cobblestone+via=stone は同関数内で同等に成立)
      const legStarted = startMission(bot, owner, r, { kind: leg.type === "hunt" ? "hunt" : "gather", target: legMissionTarget(leg), amount: remain, constraints: { hostiles: lt.hostiles, forbiddenTargets: (typeof fbIds !== "undefined" ? fbIds : []) }, sideTasks: [], returnTo: lt.returnTo, legsOnly: true }, false, { noLongTask: true });
      if (!legStarted && !r.mission) { noteFail(bot, "longtask:forbidden_leg", new Error(leg.item)); say(owner, bot, `長期タスクを中断しました。${lname(leg.item)}は、しないと約束している対象です`, true); r.longtask = null; r.mineLeg = null; r.spiral = null; saveLongTask(bot, r); return true; } // cycle0117 G2 出口A: 立たなかった leg を消費しない
      r.ltLegActive = true;
      say(owner, bot, `工程${lt.legIdx + 1}/${lt.legs.length}：${legLabel(leg, lname)}`, true);
      saveLongTask(bot, r);
      return false;
    }
    if (leg.type === "craft" || leg.type === "smelt") {
      if (countOfGroup(countInv(bot), leg.item) >= (leg.need || 1)) { lt.legIdx++; continue; }
      if (!ensureStation(bot, r, leg)) {
        // v0.4.67: 作業台・かまどを持っていない (計画処理が工程を入れ忘れることがある) なら、作る工程を差し込んで続ける
        const stationId = leg.type === "smelt" ? "minecraft:furnace" : "minecraft:crafting_table";
        leg.stationRepairs = (leg.stationRepairs || 0) + 1;
        let ins = null;
        if (!hasItem(bot, stationId) && leg.stationRepairs <= 3 && lt.legs.length <= 60) { try { const sub = planLongTask({ target: stationId, amount: 1, constraints: { forbiddenTargets: (typeof fbIds !== "undefined" ? fbIds : []) } }, countInv(bot), invDurabilityOf(bot)); if (sub && sub.feasible && sub.legs && sub.legs.length) ins = sub.legs; } catch {} }
        if (ins) { lt.legs.splice(lt.legIdx, 0, ...ins); saveLongTask(bot, r); continue; }
        say(owner, bot, `長期タスクを中断しました。${leg.type === "smelt" ? "かまど" : "作業台"}を用意できませんでした`, true); r.longtask = null; saveLongTask(bot, r); return true;
      }
      const res = leg.type === "craft" ? executeCraftLeg(invOf(bot), leg) : executeSmeltLeg(invOf(bot), leg);
      // 6-ML ML-H01/H02 (cycle1322, a02): CRAFT/SMELT の実行結果を result 軸へ記録する (記録のみ・分岐不変)。
      // fromCraftResult は act を持たないため、rec 形へ射影してから commit する (そのままでは EXP 化されない)。
      try { const norm = fromCraftResult(res); const rec = { act: leg.type === "craft" ? "CRAFT" : "SMELT", ok: !!norm?.ok, reason: norm?.reason || null, item: res?.produced || leg.item || null, gained: res?.ok ? (leg.need || 0) : 0, at: Date.now() }; if (leg.type === "craft") r.lastCraft = rec; else r.lastSmelt = rec; commitLastAction(r, rec); } catch {}
      pickUpPlacedStation(bot, r); // v0.4.67: 自分で置いた作業台・かまどは持ち歩く (置きっぱなしだと、遠くで次の工程を始めた時に用意できず中断していた)
      if (res.bucketPending > 0) { // SMELT P2: 空バケツ返却の残数は足元へ16個ずつ落とし、失敗は記録する (drink_milk と同型)
        let rest = res.bucketPending, dropFailed = false;
        while (rest > 0) { const chunk = Math.min(16, rest); try { bot.dimension.spawnItem(new ItemStack("minecraft:bucket", chunk), bot.location); rest -= chunk; try { if (shouldToss({ spawned: true, suppressed: !!((r.lastCtx?.danger?.count ?? 0) > 0) || !!r.work, lastFiredMs: r.tossAnimLastAt ?? null, nowMs: Date.now() })) { r.tossAnimAt = Date.now(); r.tossAnimLastAt = r.tossAnimAt; r.lastToss = { at: r.tossAnimAt, armPitchDeg: -35 }; } } catch {} } catch { dropFailed = true; break; } } // POLISH-ANIM-TOSS-01 (cycle1400): 出現成功の辺でのみ投げ出し表現を開始 (表示層のみ)
        if (dropFailed || rest > 0) noteFail(bot, "smelt:bucket_lost", new Error("empty bucket drop failed"));
      }
      if (res.ok) { say(owner, bot, `工程${lt.legIdx + 1}/${lt.legs.length}：${nameOfItem(res.produced || leg.item)}ができました`, true); lt.legIdx++; saveLongTask(bot, r); continue; }
      if (res.missing) { // 材料不足は、不足分の工程を組み立て直して差し込む (自己修正)
        // v0.4.67: 以前は「不足数」を必要数にした採取工程を差し込んでいた。工程側は「手持ちの合計 >= 必要数」で完了と
        // 判定するため、手持ちが少しでもあると即完了→クラフトがまた不足→差し込み…を 1 回の判断で 40 回繰り返し、
        // 工程が数分で 2000 を超えて cb_longtask の保存 (上限 32KB) に失敗していた。板材のように「集められない」材料もあった。
        leg.repairs = (leg.repairs || 0) + 1;
        if (leg.repairs > 3 || lt.legs.length > 60) {
          noteFail(bot, "longtask:repair_exhausted", new Error(`${leg.item} missing ${res.missing}`));
          say(owner, bot, `長期タスクを中断しました。${lname(res.missing)}の見積もりが合わず、材料を揃えきれませんでした`, true);
          r.longtask = null; saveLongTask(bot, r); return true;
        }
        const inv = countInv(bot);
        const needTotal = countOfGroup(inv, res.missing) + (res.missingCount || 1); // 必要数は「手持ち + 不足分」の合計
        let ins = null;
        try { const sub = planLongTask({ target: concreteItemOf(res.missing, inv), amount: needTotal, constraints: { forbiddenTargets: (typeof fbIds !== "undefined" ? fbIds : []) } }, inv, invDurabilityOf(bot)); if (sub && sub.feasible && sub.legs && sub.legs.length) ins = sub.legs; } catch {}
        if (!ins && (typeof fbIds !== "undefined" ? fbIds : []).length && ((typeof fbIds !== "undefined" ? fbIds : []).includes(res.missing) || (typeof fbIds !== "undefined" ? fbIds : []).includes(concreteItemOf(res.missing, inv)) || (typeof fbIds !== "undefined" ? fbIds : []).includes("minecraft:" + res.missing))) { noteFail(bot, "longtask:repair_exhausted", new Error(`${leg.item} missing forbidden ${res.missing}`)); say(owner, bot, `長期タスクを中断しました。${lname(res.missing)}は、しないと約束している対象です`, true); r.longtask = null; saveLongTask(bot, r); return true; } // cycle0117 G6-b: 生legフォールバックの禁止照合 (decomposer を通らない唯一の経路)
        if (!ins) ins = [{ type: "gather", item: res.missing, need: needTotal, via: null, yRange: null, depth: mineDepthFor(res.missing), crafts: 0, needs: null, station: null }];
        lt.legs.splice(lt.legIdx, 0, ...ins);
        saveLongTask(bot, r); continue;
      }
      say(owner, bot, `長期タスクを中断しました。${res.reason || "工程に失敗しました"}`, true); r.longtask = null; saveLongTask(bot, r); return true;
    }
    lt.legIdx++;
  }
  if (lt.legIdx >= lt.legs.length) { lt.phase = "deliver"; lt.deliverSince = Date.now(); lt.deliverFails = 0; saveLongTask(bot, r); say(owner, bot, `${lt.name}が揃いました。お届けします`, true); return true; }
  return false;
}
// 0-C4 RG-1 (cyc2377): 道具調達の保留 (pendingAfterTool) と道具指定の印を畳む共通掃除。
// clearPendingCondition と対で使う。中止・保留失効で残すと、無関係な次ミッションの完了時に
// 中止したはずの本来注文が finishMission 経由で復活する (ゾンビ復活) ため、終了経路では必ず消す。
function clearPendingTool(bot, r) { try { r.pendingAfterTool = null; r.requestedTool = null; r.toolAppliedLegIdx = null; if (bot) dps(bot, "cb_pending_tool", ""); } catch {} }
function savePendingTool(bot, r) { try { dps(bot, "cb_pending_tool", r.pendingAfterTool ? JSON.stringify(r.pendingAfterTool) : ""); } catch {} } // RG U3 (cyc2394): 道具調達の保留注文の保存 (R-2 gear テンプレートの横展開、保存対象は注文オブジェクト)
// 0-F R-2 (cyc2379): 防具一式の残り部位 (pendingGearSet) の保存と掃除。従来はメモリのみ保持で、
// (1) 再読込で残り部位が無言で消える (2) 中止・保留失効で畳まれず、無関係な次ミッションの完了時に
// finishMission が拾って未依頼部位を開始しうる、という道具側 RG-1 と同じ非対称が残っていた。
// 保存は DP cb_pending_gear (条件保留 cb_pending_condition と同作法)、掃除は終了経路から必ず通す。
function savePendingGearSet(bot, r) { try { dps(bot, "cb_pending_gear", Array.isArray(r.pendingGearSet) && r.pendingGearSet.length ? JSON.stringify(r.pendingGearSet) : ""); } catch {} }
function clearPendingGearSet(bot, r) { try { r.pendingGearSet = null; if (bot) dps(bot, "cb_pending_gear", ""); } catch {} }
function cancelMission(bot, owner, r, silent = false) {
  clearPendingCondition(bot, r); // E-02+E-01: 中止は条件保留も畳む (保留だけが残って後で発火するのを防ぐ。DP 側も同時に消す)
  clearPendingTool(bot, r); // RG-1 (cyc2377): 中止は道具調達の保留も畳む (条件保留と同じ非対称の解消)
  if (r.mission) { r.mission = null; clearPlanRecords(r); persistMission(bot, r, true); dps(bot, "cb_order", ""); }
  r.work = null; r.workHoldLeg = null; r.workChain = null; // cycle0033 F2: cancelled work must not keep occupying tickAutonomy
  r.buildPlan = null;
  r.buildStallKey = null; r.buildStallSince = 0; r.buildStallBest = null; r.buildDangerSince = null; r.buildDangerNoted = false; r.buildProgressAt = null; r.buildProgressIdx = null; r.buildProgressPlaced = null; // 基礎 R-3 (v0.4.81, cycle0417-a04): 中止した建築の stall/危険時計を残さない + BUILD-HOLD-NOEXIT (cycle1343)
  clearPendingGearSet(bot, r); // 0-F R-2 (cyc2379): 中止は一式の残り部位も畳む (残すと次ミッション完了時に未依頼部位が開始する)
  if (!silent) say(owner, bot, "指示、中止しました。……今の作業はここまでです", true);
}
const SUSPEND_JP = { target_not_found: "対象が見つかりませんでした", no_progress: "進捗が止まってしまいました", cannot_reach_area: "指定の場所へ辿り着けませんでした", cannot_return: "帰還できませんでした", cannot_recover: "体力が回復しませんでした", unknown_step: "手順が読み取れませんでした", inv_unreadable: "持ち物が読み取れませんでした", hostile_stuck: "敵に阻まれて進めなくなりました" }; // cannot_recover は cycle0731 / hostile_stuck は cycle0606 で追加 (欠落していた表示漏れ)
function handleMissionSay(bot, owner, r, d) {
  const m = r.mission; if (!m) return;
  if (d.reason === "step_complete") { if (!m.order.legsOnly) say(owner, bot, `${nameOfItem(m.order.target)}、必要数は揃いました。……悪くない進みです`); return; }
  if (d.reason === "mission_complete") {
    if (!m.order.legsOnly) {
      if (r.deliverFail) say(owner, bot, `集めたのですが、${m.order.returnTo === "home" ? "拠点へ入庫できませんでした" : "お渡しできませんでした"}。相手側の空きがないか、チェストが見つかりませんでした`, true);
      else say(owner, bot, `指示、完了しました。${nameOfItem(m.order.target)}を${m.order.amount}個、${m.order.returnTo === "home" ? "拠点へ入庫しました" : "お渡ししました"}`, true);
      if (!r.deliverFail && m.order.returnTo === "home") { try { if (!r.homebowState) r.homebowState = createHomebowState(); const hb = noteHomeArrival(r.homebowState, { nowMs: Date.now(), deposited: true, danger: false, falling: r.selfFalling === true }); r.homebowState = hb.state; if (hb.fired) r.lastHomebow = { at: Date.now() }; } catch {} } // POLISH-ANIM-HOMEBOW-01 feeder (表示層のみ・実機確認待ち)
    }
    r.deliverFail = false;
    finishMission(bot, owner, r);
    return;
  }
  if (typeof d.reason === "string" && d.reason.startsWith("suspended:")) {
    if (!r.suspendNotified) { r.suspendNotified = true; say(owner, bot, `指示を保留しました。${SUSPEND_JP[d.reason.slice(10)] || "進めなくなりました"}。……指示自体は残してあります`, true); }
    return;
  }
  if (d.reason === "detour_resume") say(owner, bot, "本作業に戻ります");
}
function doDeliver(bot, owner, r, m) {
  if (m.order.returnTo === "home") { execArrive(bot, owner, { act: "deposit" }, r.lastCtx || {}, null); if (r.justDeposited) { r.deliveredFlag = true; r.deliverFail = false; } return; }
  try { if (owner.dimension.id !== bot.dimension.id) { r.deliverFail = true; noteFail(bot, "deliver:dim_mismatch", new Error("owner in another dimension")); return; } } catch { r.deliverFail = true; return; } // cycle0659 F2 dim gate
  const oc = invOf(owner); if (!oc) { r.deliverFail = true; noteFail(bot, "deliver:no_owner_inv", new Error("owner inventory unavailable")); return; }
  const res = transferFiltered(bot, oc, null); recordStore(r, "doDeliver", res);
  // 検証: 1個も渡せなかったら「成功したつもり」にせず失敗として記録する
  r.deliverFail = res.moved === 0;
  if (res.moved === 0) noteFail(bot, "deliver:nothing_moved", new Error("transfer moved 0"));
  if (res.moved > 0) { const st = stats(bot); st.deliver = (st.deliver || 0) + res.moved; saveStats(bot, st); r.deliveredFlag = true; r.justDelivered = true; system.runTimeout(() => { r.justDelivered = false; }, 100); dps(bot, "cb_bond", Math.min(100, dp(bot, "cb_bond", 30) + 1)); noteNod(r, res.moved); }
}
// POLISH-ANIM-NOD-01 (cycle1036): 納品で実際に渡せたときだけ頷きを開始する (表示層のみ)
// POLISH-ANIM-FLINCH-01 (cycle1051): 予兆エンティティの出現の辺で身構えを開始する (表示層のみ・実機確認待ち)
function noteFlinch(bot, r, cand) {
  try {
    if (!r) return;
    const prev = r.flinchSeenIds instanceof Set ? r.flinchSeenIds : new Set();
    let inWater = false; try { inWater = !!bot.isInWater; } catch {}
    const res = decideFlinch(prev, Array.isArray(cand) ? cand : [], { lastFiredMs: r.flinchAnimLastAt ?? null, nowMs: Date.now(), inWater, falling: r.selfFalling === true });
    r.flinchSeenIds = new Set((Array.isArray(cand) ? cand : []).map(e => e.id));
    if (res && res.flinch) { r.flinchAnimAt = Date.now(); r.flinchAnimLastAt = r.flinchAnimAt; }
  } catch {}
}
function noteNod(r, moved) { try { if (shouldNod({ moved, lastFiredMs: r.nodAnimLastAt ?? null, nowMs: Date.now() })) { r.nodAnimAt = Date.now(); r.nodAnimLastAt = r.nodAnimAt; } } catch {} }
// POLISH-ANIM-SUMMONSCAN-01 (cycle1110): 明示召喚・復元が成功した辺でのみ見回しを開始する (表示層のみ・実機確認待ち)。追随テレポートでは呼ばない
function noteSummonScan(r) { try { if (r && shouldSummonScan({ lastFiredMs: r.summonScanLastAt ?? null, nowMs: Date.now() })) { r.summonScanAt = Date.now(); r.summonScanLastAt = r.summonScanAt; } } catch {} }
// POLISH-ANIM-SKYGLANCE-01 (cycle1133): 雨の降り始めの辺でのみ見上げを開始する (表示層のみ・実機確認待ち)。辺は結果に関わらず毎回消費する
// POLISH-ANIM-LOOKBACK-01 (cycle1153): 主人距離が閾値10を下から上へ跨いだ辺でのみ振り返りを開始する (表示層のみ・実機確認待ち)。辺は結果に関わらず毎回消費する
function noteLookback(r, c) {
  try {
    if (!r || !c) return;
    const prev = r.lookbackPrevDist;
    const d = c.self?.distOwner;
    r.lookbackPrevDist = d;
    let inWater = false; try { inWater = !!c.x?.inWater; } catch {}
    if (shouldLookback({ prevDist: prev, dist: d, danger: !!(c.danger && c.danger.count > 0), working: !!r.work, falling: r.selfFalling === true, inWater, inspectActive: isInspectActive(r.inspectAnimAt, Date.now()), nodActive: isNodActive(r.nodAnimAt, Date.now()), flinchActive: isFlinchActive(r.flinchAnimAt, Date.now()), summonScanActive: isSummonScanActive(r.summonScanAt, Date.now()), skyglanceActive: isSkyglanceActive(r.skyglanceAt, Date.now()), lastFiredMs: r.lookbackAnimLastAt ?? null, nowMs: Date.now() })) { r.lookbackAnimAt = Date.now(); r.lookbackAnimLastAt = r.lookbackAnimAt; }
  } catch {}
}
// POLISH-ANIM-DRYOFF-01 (cycle1322): 雨上がりの辺でのみ水払いを開始する (表示層のみ・実機確認待ち)。状態は dryoffState に分離保持し skyglance の prevRaining と干渉しない
// POLISH-ANIM-THRESHOLD-01 (cycle1503): 狭い開口部 (左右が固体で挟まれた足セル) へ入った辺でのみ発火を記録する (表示層のみ・実機確認待ち)。開口判定は種別でなく固体配置だけを見る汎用形。
function noteThreshold(bot, dim, r, c) {
  try {
    if (!bot || !dim || !r) return;
    if (!r.thresholdState) r.thresholdState = createThresholdState();
    const fx = Math.floor(bot.location.x), fy = Math.floor(bot.location.y), fz = Math.floor(bot.location.z);
    const solid = (x, y, z) => { try { const b = dim.getBlock({ x, y, z }); return !!b && solidOfTypeId(b.typeId) && !b.isLiquid; } catch { return false; } };
    const inOpening = (solid(fx - 1, fy, fz) && solid(fx + 1, fy, fz)) || (solid(fx, fy, fz - 1) && solid(fx, fy, fz + 1));
    const fired = noteThresholdState(r.thresholdState, { inOpening, nowMs: Date.now(), danger: !!(c?.danger && c.danger.count > 0), hasWorkTarget: !!r.work, falling: r.selfFalling === true, inWater: !!c?.x?.inWater, flinchActive: isFlinchActive(r.flinchAnimAt, Date.now()) });
    if (fired) r.lastThreshold = { at: Date.now(), firedCount: r.thresholdState.firedCount };
  } catch {}
}
// POLISH-ANIM-ICEBALANCE-01 (cycle1543): 氷上で止まる/向きを変える辺でのみバランス取りを記録する (表示層のみ・実機確認待ち)。
// 足元カテゴリは sfx.js の分類が単一の正。ロール/腕は RP 受け口が無いため r.lastIcebalance 記録のみ、ピッチだけ applyGaze 最下位へ重畳する。
function noteIcebalanceTick(bot, dim, r, c) {
  try {
    if (!bot || !dim || !r) return;
    if (!r.icebalanceState) r.icebalanceState = createIcebalanceState();
    let groundCategory = null;
    try { const gb = dim.getBlock({ x: Math.floor(bot.location.x), y: Math.floor(bot.location.y) - 1, z: Math.floor(bot.location.z) }); if (gb) groundCategory = materialOfTypeId(gb.typeId); } catch {}
    let horizSpeed = null;
    try { const v = bot.getVelocity(); if (v) horizSpeed = Math.abs(v.x) + Math.abs(v.z); } catch {}
    let yawDeg = null;
    try { const rot = bot.getRotation(); if (rot && Number.isFinite(rot.y)) yawDeg = rot.y; } catch {}
    let flying = false; try { flying = bot.isFlying === true; } catch {}
    const fired = noteIcebalanceState(r.icebalanceState, { groundCategory, horizSpeed, yawDeg, nowMs: Date.now(), danger: !!(c?.danger && c.danger.count > 0), hasWorkTarget: !!r.work, falling: r.selfFalling === true, selfFalling: r.selfFalling === true, inWater: !!c?.x?.inWater, flying, flinchActive: isFlinchActive(r.flinchAnimAt, Date.now()), intentionalDescent: !!(r.mission?.descent || r.spiralDescent) });
    if (fired) { const s = sampleIcebalance(r.icebalanceState, Date.now()); r.lastIcebalance = { at: Date.now(), firedCount: r.icebalanceState.firedCount, trigger: s.trigger, rollSign: s.rollSign }; }
  } catch {}
}

// POLISH-ANIM-SNOWTREAD-01 (cycle2333): 雪カテゴリの足元を歩行し続ける間だけ沈み込み位相を進める (表示層のみ・実機確認待ち)。
// 足元カテゴリは sfx.js の分類が単一の正。体の沈みは RP 受け口が無いため r.lastSnowtread 記録のみ、ピッチだけ applyGaze へ重畳する。
function noteSnowtreadTick(bot, dim, r, c) {
  try {
    if (!bot || !dim || !r) return;
    if (!r.snowtreadState) r.snowtreadState = createSnowtreadState();
    let surfaceCategory;
    try { const gb = dim.getBlock({ x: Math.floor(bot.location.x), y: Math.floor(bot.location.y) - 1, z: Math.floor(bot.location.z) }); if (gb) surfaceCategory = materialOfTypeId(gb.typeId); } catch {}
    const now = Date.now();
    let speed = 0, moved = 0;
    try {
      const lp = r.snowtreadLastPos, lt = r.snowtreadLastAt || 0;
      if (lp) { moved = Math.hypot(bot.location.x - lp.x, bot.location.z - lp.z); const dt = (now - lt) / 1000; if (dt > 0) speed = moved / dt; r.snowtreadDist = (r.snowtreadDist || 0) + moved; }
      r.snowtreadLastPos = { x: bot.location.x, z: bot.location.z }; r.snowtreadLastAt = now;
    } catch {}
    let flying = false; try { flying = bot.isFlying === true; } catch {}
    const ev = noteSnowtread(r.snowtreadState, { surfaceCategory, grounded: !flying && r.selfFalling !== true, moving: moved > 0.01, speed, falling: r.selfFalling === true, flying, inWater: !!bot.isInWater, combat: !!((c?.danger?.count ?? 0) > 0) }, r.snowtreadDist || 0);
    if (ev && ev.entered) r.lastSnowtread = { at: now, episode: r.snowtreadState.episode };
  } catch {}
}

// POLISH-ANIM-STEPUP-01 (cycle1603): 地上歩行で足元がちょうど +1 上がった辺でのみ発火を記録する (表示層のみ・実機確認待ち)。
// 膝上げは RP 受け口が無いため r.lastStepup 記録のみ、視線ピッチだけ applyGaze 最下位へ重畳する。
function noteStepupTick(bot, dim, r, c) {
  try {
    if (!bot || !r) return;
    if (!r.stepupState) r.stepupState = createStepupState();
    const footY = Math.floor(bot.location.y);
    let flying = false; try { flying = bot.isFlying === true; } catch {}
    const fired = noteStepupState(r.stepupState, { footY, nowMs: Date.now(), danger: !!(c?.danger && c.danger.count > 0), hasWorkTarget: !!r.work, falling: r.selfFalling === true, selfFalling: r.selfFalling === true, inWater: !!c?.x?.inWater, flying, hovering: flying, flinchActive: isFlinchActive(r.flinchAnimAt, Date.now()), intentionalDescent: !!(r.mission?.descent || r.spiralDescent) });
    if (fired) { const s = sampleStepup(r.stepupState, Date.now()); r.lastStepup = { at: Date.now(), firedCount: r.stepupState.firedCount, trigger: s.trigger }; }
  } catch {}
}
// POLISH-ANIM-EDGEPEEK-01 (cycle1518): 進行方向 1 セル先の落差が 2〜4 マスの範囲へ入った辺でのみ発火を記録する (表示層のみ・実機確認待ち)。落差は固体配置だけから取る汎用形で、ブロック種別の個別判定はしない
function noteEdgepeek(bot, dim, r, c) {
  try {
    if (!bot || !dim || !r) return;
    if (!r.edgepeekState) r.edgepeekState = createEdgepeekState();
    const rot = (() => { try { return bot.getRotation(); } catch { return null; } })();
    if (!rot || !Number.isFinite(rot.y)) return;
    const rad = rot.y * Math.PI / 180;
    const dx = Math.round(-Math.sin(rad)), dz = Math.round(Math.cos(rad));
    const fx = Math.floor(bot.location.x), fy = Math.floor(bot.location.y), fz = Math.floor(bot.location.z);
    const solid = (x, y, z) => { try { const b = dim.getBlock({ x, y, z }); return !!b && solidOfTypeId(b.typeId) && !b.isLiquid; } catch { return false; } };
    let dropDepth;
    if (!solid(fx + dx, fy - 1, fz + dz)) {
      for (let d = 1; d <= 8; d++) { if (solid(fx + dx, fy - 1 - d, fz + dz)) { dropDepth = d; break; } }
    } else { dropDepth = 0; }
    const fired = noteEdgepeekState(r.edgepeekState, { dropDepth, nowMs: Date.now(), danger: !!(c?.danger && c.danger.count > 0), hasWorkTarget: !!r.work, falling: r.selfFalling === true, selfFalling: r.selfFalling === true, inWater: !!c?.x?.inWater, flinchActive: isFlinchActive(r.flinchAnimAt, Date.now()), intentionalDescent: !!(r.mission?.descent || r.spiralDescent) });
    if (fired) r.lastEdgepeek = { at: Date.now(), firedCount: r.edgepeekState.firedCount };
  } catch {}
}
function noteRainshelter(bot, dim, r, c) {
  try {
    if (!r.rainshelterState) r.rainshelterState = createRainShelterState();
    const now = Date.now();
    const raining = c?.env?.isRaining === true;
    if (raining) { if (!r.rainSinceMs) r.rainSinceMs = now; } else { r.rainSinceMs = null; r.rainshelterExposed = null; r.rainshelterCoverYaw = null; }
    if (raining && r.rainSinceMs && now - r.rainSinceMs >= 20000 && now - (r.rainshelterScanAt || 0) >= 1000) {
      r.rainshelterScanAt = now;
      try {
        const fx = Math.floor(bot.location.x), fy = Math.floor(bot.location.y), fz = Math.floor(bot.location.z);
        const solid = (x, y, z) => { try { const b = dim.getBlock({ x, y, z }); return !!b && solidOfTypeId(b.typeId) && !b.isLiquid; } catch { return false; } };
        let exp = true; for (let dy = 2; dy <= 6; dy++) { if (solid(fx, fy + dy, fz)) { exp = false; break; } }
        r.rainshelterExposed = exp;
        if (exp) {
          let bestD = 1e9, bestYaw = null;
          let botYaw = 0; try { botYaw = bot.getRotation().y; } catch {}
          for (let k = 0; k < 8; k++) { const ang = k * Math.PI / 4; const dx = Math.round(Math.sin(ang)), dz = Math.round(Math.cos(ang)); if (!dx && !dz) continue; for (let d = 2; d <= 12; d++) { const cx = fx + dx * d, cz = fz + dz * d; let roof = false; for (let dy = 2; dy <= 6; dy++) { if (solid(cx, fy + dy, cz)) { roof = true; break; } } if (roof) { if (d < bestD) { bestD = d; const ayaw = Math.atan2(-(cx + 0.5 - bot.location.x), cz + 0.5 - bot.location.z) * 180 / Math.PI; bestYaw = ((ayaw - botYaw + 540) % 360) - 180; } break; } } }
          r.rainshelterCoverYaw = bestYaw;
        } else r.rainshelterCoverYaw = null;
      } catch {}
    }
    const mode = (r.work || r.mission) ? "work" : "idle";
    const res = noteRainShelter(r.rainshelterState, { isRaining: raining, rainSinceMs: r.rainSinceMs, nowMs: now, mode, exposed: r.rainshelterExposed ?? null, coverRelYawDeg: r.rainshelterCoverYaw ?? null, inCombat: false, dangerNear: !!((c?.danger?.count ?? 0) > 0), falling: r.selfFalling === true, inWater: !!c?.x?.inWater, underground: !!c?.x?.underground, workTargetActive: !!r.work, higherGazeActive: isFlinchActive(r.flinchAnimAt, now) });
    if (res?.fired) r.lastRainShelter = { at: now, yawDeg: r.rainshelterState.lockedYawDeg };
  } catch {}
}
function noteDryoff(r, c) {
  try {
    if (!r || !c) return;
    if (!r.dryoffState) r.dryoffState = { prevRaining: undefined, startedAtMs: null, lastFiredAtMs: null };
    let inWater = false; try { inWater = !!c.x?.inWater; } catch {}
    const fired = noteDryoffState(r.dryoffState, { isRaining: c.env?.isRaining === true, nowMs: Date.now(), danger: !!(c.danger && c.danger.count > 0), hasWorkTarget: !!r.work, falling: r.selfFalling === true, inWater, flinchActive: isFlinchActive(r.flinchAnimAt, Date.now()), inspectActive: isInspectActive(r.inspectAnimAt, Date.now()), nodActive: isNodActive(r.nodAnimAt, Date.now()), skyglanceActive: isSkyglanceActive(r.skyglanceAt, Date.now()), lookbackActive: isLookbackActive(r.lookbackAnimAt, Date.now()), summonScanActive: isSummonScanActive(r.summonScanAt, Date.now()) });
    if (fired) r.dryoffAt = r.dryoffState.startedAtMs;
  } catch {}
}
function noteSkyglance(r, raining, danger) {
  try {
    if (!r) return;
    const was = r.prevRaining;
    r.prevRaining = raining === true;
    if (shouldSkyglance({ wasRaining: was, isRaining: raining === true, danger: danger === true, hasWorkTarget: !!r.work, flinchActive: isFlinchActive(r.flinchAnimAt, Date.now()), inspectActive: isInspectActive(r.inspectAnimAt, Date.now()), nodActive: isNodActive(r.nodAnimAt, Date.now()), lastFiredAtMs: r.skyglanceLastAt ?? null, nowMs: Date.now() })) { r.skyglanceAt = Date.now(); r.skyglanceLastAt = r.skyglanceAt; }
  } catch {}
}
function noteHorizonGlance(bot, r, c) {
  try {
    if (!r) return;
    if (!r.horizonState) r.horizonState = createHorizonState();
    const phase = c?.env?.isDawn ? "dawn" : c?.env?.isDusk ? "dusk" : c?.env?.isNight ? "night" : "day";
    const ev = noteHorizon(r.horizonState, { phase, nowMs: Date.now(), danger: !!((c?.danger?.count ?? 0) > 0), hasWorkTarget: !!r.work, falling: r.selfFalling === true, inWater: !!bot.isInWater, skyVisible: undefined });
    if (ev?.fired) r.lastHorizonGlance = { at: Date.now(), band: phase };
  } catch {}
}
// POLISH-ANIM-FULLMOONGAZE-01 feeder (v0.5.80): 月相は world.getMoonPhase() が取れる場合のみ供給する。
// 取れない環境では undefined を渡し、純粋核側が UNKNOWN として状態を変えない (満月扱いにしない)。
// nightKey は world.getDay()。新規走査なし・表示層のみ・実機確認待ち。
function noteFullMoonGaze(bot, r, c) {
  try {
    if (!r) return;
    if (!r.fullmoonState) r.fullmoonState = createFullMoonState();
    let phaseIdx; try { const mp = typeof world.getMoonPhase === "function" ? world.getMoonPhase() : undefined; phaseIdx = typeof mp === "number" ? mp : undefined; } catch { phaseIdx = undefined; }
    let nightKey; try { nightKey = world.getDay(); } catch { nightKey = undefined; }
    const ev = noteFullMoon(r.fullmoonState, { moonPhaseIndex: phaseIdx, nightKey, isNight: c?.env?.isNight === true, nowMs: Date.now(), danger: !!((c?.danger?.count ?? 0) > 0), combat: !!((c?.danger?.count ?? 0) > 0), falling: r.selfFalling === true, inWater: !!bot.isInWater, isRaining: c?.env?.isRaining === true, hasWorkTarget: !!r.work });
    if (ev?.fired) r.lastFullMoonGaze = { at: Date.now(), nightKey };
  } catch {}
}
// ENV-02 出口 (cycle0340): lavaStuck 累計は env02_math の純粋核が単独で更新する
// (移動ループの別経路で消されない)。進捗 = 足場の設置数増加。申告は1回だけ。
function noteLavaStuck(bot, owner, r, c) {
  try {
    if (!r) return;
    const inLava = !!(c?.x?.selfInLava);
    const placedN = r.bridgePlacedTotal || 0; // cyc2363 A20: 切り詰めで固定される placed.length でなく単調カウンタで進捗を見る
    const progressed = inLava && r.lavaStuckBridgeN != null && placedN > r.lavaStuckBridgeN;
    r.lavaStuckBridgeN = placedN;
    const res = lavaStuckStep(r.lavaStuck || null, inLava, Date.now(), progressed);
    r.lavaStuck = res.state;
    if (res.declare) {
      try { noteFail(bot, "lava:hopeless_exhausted", new Error("lava stuck 30s without progress"), { expDone: true }); } catch {}
      try { say(owner, bot, "足場を作れません。ブロックを投げ渡してください", true); } catch {}
    }
  } catch {}
}
function noteNightwatchTick(bot, r, c) {
  try {
    if (!r) return;
    if (!r.nightwatchState) r.nightwatchState = createNightwatchState();
    const phase = c?.env?.isNight ? "night" : c?.env?.isDawn ? "dawn" : c?.env?.isDusk ? "dusk" : "day";
    const now = Date.now();
    const idleMs = r.idleSinceMs != null ? now - r.idleSinceMs : null;
    // a16 条件: otherOverlayActive は過渡的な上位重畳のみ (持続型を含めると常時抑制で発火不能)、
    // hovering は実飛行中のみ (常時 true だと受動待機で発火不能) のため、ここではどちらも渡さない
    const ev = noteNightwatch(r.nightwatchState, { phase, idleSustainedMs: idleMs, nowMs: now, danger: !!((c?.danger?.count ?? 0) > 0), hasWorkTarget: !!r.work, falling: r.selfFalling === true, inWater: !!bot.isInWater });
    if (ev?.fired) r.lastNightwatch = { at: now };
  } catch {}
}
function execSideTask(bot, owner, r, ctx, scan) {
  const t = r.sideTask; if (!t) return;
  // SIDE-COOLDOWN-CHASE (cycle1134): クールダウンは終端でのみ書く。接近中は同一候補を保持し続ける
  try {
    if (!r.sideChase) r.sideChase = createSideChase();
    const range = sideChaseRangeFor(t.type);
    let distNow = null;
    try { distNow = dist(bot.location, t.pos); } catch {}
    const candAlive = !!(ctx?.x?.opportunities || []).some((o) => t.targetId ? o.id === t.targetId : true);
    const ev = chaseTick(r.sideChase, { task: t, distNow, candAlive: t.targetId ? candAlive : true, nowMs: Date.now(), range });
    r.sideContinuation = ev.phase === "continue";
    r.lastSideChase = { phase: ev.phase, reason: ev.reason || null, at: Date.now() };
    if (ev.writeCooldown) { try { noteAttempt(r.sideState, t, Date.now()); } catch {} }
    if (ev.phase === "abandon") { r.sideHeldTask = null; return; }
    if (ev.phase === "complete" && t.type !== "pickup" && t.type !== "hunt") { /* break/harvest は距離完了を使わない */ }
  } catch {}
  if (t.type === "pickup") {
    r.target = { x: t.pos.x, y: t.pos.y, z: t.pos.z }; // cycle1134: item 実体座標に +0.5 を付けない
    const e = (scan?.items || []).find((x) => x.id === t.targetId);
    if (e && dist(bot.location, e.location) < 1.9) pickupItemEntity(bot, owner, e, ctx);
  } else if (t.type === "hunt") {
    const e = [...(scan?.hostiles || []), ...(scan?.animals || [])].find((x) => x.id === t.targetId) || [...(scan?.hostiles || []), ...(scan?.animals || [])].find((x) => x.typeId === t.entityType);
    if (e) { r.target = { ...e.location }; if (dist(bot.location, e.location) < 3.2) zapEntity(bot, r, e); }
    else r.target = { x: t.pos.x + 0.5, y: t.pos.y, z: t.pos.z + 0.5 };
  } else if (t.type === "break" || t.type === "harvest") {
    if (startWork(bot, r, { x: t.pos.x, y: t.pos.y, z: t.pos.z, typeId: t.blockType })) tickWork(bot, owner, r, ctx);
    else r.target = { x: t.pos.x + 0.5, y: t.pos.y, z: t.pos.z + 0.5 };
  }
}
// 0-C R-C4-4 S5 (cyc2383): 溶岩充填の安全な立ち位置 (設計 tests/cyc2382_a16_rc44s5.md §3)。
// lavaNear は媒体セルでなく立ち位置候補へ当て、媒体方向の近傍は除外して数える。
function fillSafeStand(bot, mediumLoc) {
  try {
    const dim = bot.dimension;
    const free = (x, y, z) => { try { const b = dim.getBlock({ x, y, z }); if (!b) return false; return !solidOfTypeId(b.typeId) && !b.isLiquid; } catch { return false; } };
    const cands = [];
    for (const dy of ACCESS.STAND_DY) for (const [dx, dz] of ACCESS.DIRS) {
      const x = mediumLoc.x + dx, y = mediumLoc.y + dy, z = mediumLoc.z + dz;
      let lavaAround = false;
      for (const [ox, oy, oz] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const nx = x + ox, ny = y + oy, nz = z + oz;
        if (nx === mediumLoc.x && ny === mediumLoc.y && nz === mediumLoc.z) continue; // 媒体方向は除外 (第2の罠)
        try { const b = dim.getBlock({ x: nx, y: ny, z: nz }); if (b && b.typeId.includes("lava")) { lavaAround = true; break; } } catch {}
      }
      cands.push({ loc: { x, y, z }, free: free(x, y, z) && free(x, y + 1, z), lavaAround });
    }
    return selectSafeFillStand({ candidates: cands, selfPos: bot.location }).stand;
  } catch { return null; }
}
// S5: tx 直前の現在位置再確認。危険なら tx 0回で媒体セルを60秒 ban し、理由を伝える。
function fillLavaGate(bot, owner, r) {
  try {
    if (r.mTargetFillItem !== "minecraft:lava_bucket" || !r.mTargetLoc) return false;
    const dim = bot.dimension, p = bot.location;
    const cell = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) };
    let selfTypeId = null; try { selfTypeId = dim.getBlock(cell)?.typeId || null; } catch {}
    const neigh = [];
    for (const [ox, oy, oz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const n = { x: cell.x + ox, y: cell.y + oy, z: cell.z + oz };
      if (n.x === r.mTargetLoc.x && n.y === r.mTargetLoc.y && n.z === r.mTargetLoc.z) continue;
      try { const b = dim.getBlock(n); if (b) neigh.push(b.typeId); } catch {}
    }
    if (!fillStandUnsafe({ selfTypeId, neighborTypeIds: neigh })) return false;
    r.lastFill = { act: "FILL", ok: false, reason: "unsafe_stand", item: r.mTargetFillItem, at: Date.now() };
    r.mBanKey = `${Math.floor(r.mTargetLoc.x)},${Math.floor(r.mTargetLoc.y)},${Math.floor(r.mTargetLoc.z)}`; r.mBanUntil = Date.now() + 60000; r.mTargetLoc = null; r.mTargetKey = "";
    if (Date.now() - (r.fillUnsafeSaidAt || 0) > 60000) { r.fillUnsafeSaidAt = Date.now(); try { say(owner, bot, "溶岩のそばに安全に立てる場所がないため、その溶岩は汲みません", true); } catch {} }
    return true;
  } catch { return false; }
}
// 0-C R-C4-4 S4 (cyc2382): 充填 tx の実行部。設計は tests/cyc2381_a16_rc44s4.md §4 が正。
// isAdult は判定手段が無い間は渡さない (false を渡すと全頭 not_adult で永久に充填できない)。
// no_container は失敗記録だけで済ませず、連続3回で本人へ明示する (単発経路には子legが無いため)。
function fillOnce(bot, owner, r) {
  try {
    const item = r.mTargetFillItem || null;
    const def = item ? fillDefOf(item) : null;
    if (!item || !def) { r.lastFill = { act: "FILL", ok: false, reason: "unknown_item", item, at: Date.now() }; return false; }
    if (fillLavaGate(bot, owner, r)) return false; // S5: 溶岩では現在位置が危険なら tx を撃たない
    const step = r.mission?.steps?.[r.mission?.currentStep];
    const want = Math.max(1, step?.need || 1);
    const before0 = countInv(bot);
    if (fillRunsNeeded(def, before0[item] || 0, want) <= 0) return false; // 過充填ガード: 進捗の正である所持数で切る
    const isBlock = def.mediumKind === "block";
    let mediumTypeId = r.mTargetType || null, mediumPresent = false, sameDim = true, dest = null;
    if (isBlock) {
      let b = null; try { b = bot.dimension.getBlock(r.mTargetLoc); } catch {}
      mediumPresent = !!b && isSourceMediumCell(def, b.typeId);
      mediumTypeId = b?.typeId || null;
      dest = r.mTargetLoc ? { x: r.mTargetLoc.x + 0.5, y: r.mTargetLoc.y + 0.5, z: r.mTargetLoc.z + 0.5 } : null;
    } else {
      const e = r.mTargetEntity;
      try { mediumPresent = !!e && (typeof e.isValid === "function" ? !!e.isValid() : !!e.isValid); } catch { mediumPresent = false; }
      if (e) { mediumTypeId = e.typeId || mediumTypeId; try { sameDim = e.dimension?.id === bot.dimension.id; } catch {} dest = { ...e.location }; }
    }
    const inRange = dest ? dist(bot.location, dest) <= 2.6 : false;
    const pre = checkFillPreconditions({ item, inv: before0, mediumTypeId, mediumPresent, sameDim, inRange });
    if (!pre.ok) {
      r.lastFill = { act: "FILL", ok: false, reason: pre.reason, item, at: Date.now() };
      if (pre.reason === "no_container") { r.fillNoContainerStreak = (r.fillNoContainerStreak || 0) + 1; if (r.fillNoContainerStreak >= 3 && Date.now() - (r.fillNoContainerSaidAt || 0) > 60000) { r.fillNoContainerSaidAt = Date.now(); try { say(owner, bot, "バケツがありません。容器を用意してください", true); } catch {} } }
      return false;
    }
    r.fillNoContainerStreak = 0;
    const before = countInv(bot);
    if (!takeFromInv(bot, def.container, 1)) { r.lastFill = { act: "FILL", ok: false, reason: "no_container", item, at: Date.now() }; return false; }
    if (isBlock) {
      try { bot.dimension.getBlock(r.mTargetLoc).setType("minecraft:air"); }
      catch (err) { // 源泉を消せなければ容器を返して複製を作らない
        try { const bc = invOf(bot); let rest = 1; if (bc) rest = addTo(bc, def.container, 1); if (rest > 0) bot.dimension.spawnItem(new ItemStack(def.container, rest), bot.location); } catch {}
        r.lastFill = { act: "FILL", ok: false, reason: "medium_consume_failed", item, at: Date.now() }; noteFail(bot, "fill:medium_consume", err, { expDone: true }); return false;
      }
    }
    let dropped = 0;
    try { const bc = invOf(bot); let rest = 1; if (bc) rest = addTo(bc, item, 1); if (rest > 0) { bot.dimension.spawnItem(new ItemStack(item, rest), bot.location); dropped = rest; } } catch {}
    const after = countInv(bot);
    const ver = verifyFillPost({ item, before, after, dropped });
    if (!ver.ok) { r.lastFill = { act: "FILL", ok: false, reason: ver.reason, item, at: Date.now() }; noteFail(bot, "fill:verify", new Error(ver.reason), { expDone: true }); return false; }
    r.lastFill = { act: "FILL", ok: true, item, medium: mediumTypeId, at: Date.now() };
    commitLastAction(r, r.lastFill);
    return true;
  } catch (err) { try { noteFail(bot, "fill:exception", err, { expDone: true }); } catch {} return false; }
}
function applyDirective(bot, owner, r, ctx, scan, d) {
  const m = r.mission;
  switch (d.action) {
    case "move": {
      let tgt = null; const t = d.target;
      if (t === "owner") tgt = behindOf(owner, 2);
      else if (t === "home") { const h = homeOf(bot); tgt = h ? { x: h.x + 0.5, y: h.y + 1, z: h.z + 0.5 } : behindOf(owner, 2); }
      else if (t && t.type === "search" && t.regionMode) { const c = t.center || bot.location; const nr = nextExploreRegion(bot.dimension.id, c, bot.location); tgt = nr ? { x: nr.x, y: bot.location.y, z: nr.z } : { ...bot.location }; r.exploreRegion = nr; } // v0.4.66: まだ調べていない区画の中心へ
      else if (t && t.type === "search") { if (t.wp) { tgt = { x: t.wp.x, y: bot.location.y, z: t.wp.z }; } else { const c = t.center || bot.location; const ang = ((r.mission?.obsCount || 0) % 8) * (Math.PI / 4); const rad = Math.min(t.radius || 8, 24); tgt = { x: c.x + Math.cos(ang) * rad, y: c.y, z: c.z + Math.sin(ang) * rad }; } } // v0.4.64: 巡回点 wp があればそこへ直行する (旧来の毎秒45°回転は円運動の原因だったため wp 無しの後方互換としてのみ残す)
      else if (t && typeof t === "object" && typeof t.x === "number") tgt = { x: t.x, y: t.y, z: t.z };
      else tgt = behindOf(owner, 2);
      r.target = tgt; r.moveAct = "follow";
      break;
    }
    case "work": {
      if (d.step === "side_collect" && r.sideTask) { execSideTask(bot, owner, r, ctx, scan); r.moveAct = "follow"; break; }
      if (r.mTargetKind === "fill_medium") { const e = r.mTargetEntity; const dest = e ? { ...e.location } : (r.mTargetType === "minecraft:lava" && r.mTargetFillStand ? { x: r.mTargetFillStand.x + 0.5, y: r.mTargetFillStand.y, z: r.mTargetFillStand.z + 0.5 } : { x: r.mTargetLoc.x + 0.5, y: r.mTargetLoc.y, z: r.mTargetLoc.z + 0.5 }); r.target = dest; try { r.lastFillApproach = { typeId: r.mTargetType, at: Date.now(), inRange: dist(bot.location, dest) <= 2.6 }; if (r.lastFillApproach.inRange) fillOnce(bot, owner, r); } catch {} } // R-C4-4 S3/S4/S5: 媒体へ接近し、範囲内なら充填tx (fillOnce) を撃つ。溶岩は安全な立ち位置を dest にする。zapEntity/startWork へは接続しない
      else if (r.mTargetKind === "entity" && r.mTargetEntity) { const e = r.mTargetEntity; r.target = { ...e.location }; if (dist(bot.location, e.location) < 3.2) zapEntity(bot, r, e); }
      else if (r.mTargetKind === "item" && r.mTargetEntity) { const e = r.mTargetEntity; r.target = { x: e.location.x, y: e.location.y, z: e.location.z }; if (dist(bot.location, e.location) < 1.9) pickupItemEntity(bot, owner, e, ctx); }
      else if (r.mTargetLoc && r.mTargetKind === "block" && shouldTunnel(bot, r, r.mTargetLoc)) tickTunnel(bot, owner, r, ctx, r.mTargetLoc); // v0.4.66: 地中の対象へ掘り進む
      else if (r.mTargetLoc) { if (r.tunnel) r.tunnel = null; r.d2Anchor = null; if (startWork(bot, r, { x: r.mTargetLoc.x, y: r.mTargetLoc.y, z: r.mTargetLoc.z, typeId: r.mTargetType })) tickWork(bot, owner, r, ctx); else r.target = { x: r.mTargetLoc.x + 0.5, y: r.mTargetLoc.y, z: r.mTargetLoc.z + 0.5 }; }
      else r.target = behindOf(owner, 2);
      r.moveAct = "follow";
      break;
    }
    case "withdraw": { // Phase2 WITHDRAW Step B: 範囲外は移動のみ (runWithdraw 0回)、範囲内だけ不足分を1回実行
      const t = d.target;
      if (!t || typeof t.x !== "number") { r.target = { ...bot.location }; break; }
      const center = { x: t.x + 0.5, y: t.y + 0.5, z: t.z + 0.5 };
      if (dist(bot.location, center) > WITHDRAW_RANGE) { r.target = center; r.moveAct = "follow"; r.withdrawTargetKey = d.withdrawKey || null; break; }
      const res = runWithdraw(bot, r, { from: { x: t.x, y: t.y, z: t.z, dim: t.dim || bot.dimension.id }, item: t.item, count: Math.max(1, d.needRemaining || 1) });
      handleWithdrawResult(bot, r, m, t, res);
      r.target = { ...bot.location };
      break;
    }
    case "zap": { const e = scan?.nearestHostile; if (e) { r.target = { ...e.location }; if (dist(bot.location, e.location) < 3.2) zapEntity(bot, r, e); } r.moveAct = "zap"; break; }
    case "deliver": { const rp = returnPoint(bot, owner, m); r.target = rp; if (r.mAtReturn) doDeliver(bot, owner, r, m); r.moveAct = "follow"; break; }
    case "say": handleMissionSay(bot, owner, r, d); r.target = { ...bot.location }; break;
    default: r.target = { ...bot.location }; break;
  }
}
// 固定中のミッション目標がまだ実在するか（ブロックは同種か／エンティティ・アイテムは有効か）
function missionTargetValid(bot, r) {
  if (!r.mTargetLoc) return false;
  if (r.mTargetKind === "fill_medium" && !r.mTargetEntity) { let b = null; try { b = bot.dimension.getBlock(r.mTargetLoc); } catch {} return !!b && b.typeId === r.mTargetType; } // R-C4-4 S3: block媒体はセル再読で固定を解く。entity媒体は下の汎用entity検査へ落とす
  if (r.mTargetKind === "block") { let b = null; try { b = bot.dimension.getBlock(r.mTargetLoc); } catch {} return !!b && b.typeId === r.mTargetType; }
  if (r.mTargetEntity) { try { const valid = typeof r.mTargetEntity.isValid === "function" ? !!r.mTargetEntity.isValid() : !!r.mTargetEntity.isValid; if (!valid) return false; if (r.mTargetKind === "item") { // PICKUP-ITEMVALID-01 (cyc2365 A04): アイテム実体の typeId は常時 "minecraft:item" で依頼IDと一致しないため、種別照合はスタックの typeId で行う (従来は常時 false で固定が死に毎tick再走査＋見切り不発だった)
      let stackType = null; try { stackType = r.mTargetEntity.getComponent("minecraft:item")?.itemStack?.typeId || null; } catch {}
      if (r.mTargetType && stackType && stackType !== r.mTargetType) return false; return true; }
    if (r.mTargetType && r.mTargetType !== "hostile" && r.mTargetType.includes(":") && r.mTargetEntity.typeId && r.mTargetEntity.typeId !== r.mTargetType) return false; return true; } catch { return false; } } // HUNT-SUBST-01 (cyc2364): 固定対象も block 分岐と同型に種別照合する (汎用指定はスキップ)
  return true;
}
// 0-C2 読み手 (cycle1337): 条件付き注文の発火側。保留は行き止まりにせず、条件成立で1回だけ開始する。
// 発火前に保留を消すことで二重発火を防ぎ、期限切れは取り下げて出口を保証する。評価は condition_math の三状態で、fire の時だけ動く。
function tickPendingCondition(bot, owner, r, ctx) {
  try {
    const pend = r.pendingConditionOrder; if (!pend) return false;
    const now = Date.now();
    if (conditionExpired(pend.at, now)) { clearPendingCondition(bot, r); try { say(owner, bot, "条件の指示は、時間が経ったので取り下げました", true); } catch {} return false; }
    if ((r.mission && r.mission.status === "active") || r.longtask || r.buildPlan) return false;
    if (now - (r.pendingConditionCheckAt || 0) < 3000) return false;
    r.pendingConditionCheckAt = now;
    const o = pend.order; const cond = o?.constraints?.condition;
    if (!cond) { clearPendingCondition(bot, r); return false; }
    const verdict = evalCondition(cond, { isRaining: ctx?.env?.isRaining === true, isNight: ctx?.env?.isNight === true, isDawn: ctx?.env?.isDawn === true, ownerHunger: typeof ctx?.owner?.hunger === "number" ? ctx.owner.hunger : undefined });
    if (verdict !== "fire") return false;
    clearPendingCondition(bot, r);
    // R-C2-4 (cyc2380): window (継続条件) の注文は、開始時に条件の写しを constraints.window へ移す。
    // condition は従来どおり null に潰し再保留ループを防ぐ。start 形では window を付けない。
    const isWindow = conditionRole(cond) === "window";
    const fireOrder = { ...o, constraints: { ...(o.constraints || {}), condition: null, ...(isWindow ? { window: { raw: cond.raw || "", kind: cond.kind } } : {}) } };
    try { say(owner, bot, `条件が来ました。${o.target?.name || "その対象"}の指示を始めます`, true); } catch {}
    startOrderFromParser(owner, bot, r, fireOrder);
    return true;
  } catch { return false; }
}
// R-C2-4 (cyc2380): window (継続条件) の終了監視。tickPendingCondition の冒頭ガード (mission 稼働中は
// return) の内側には置かず、tick ループから独立に呼ばれる。対象は mission.order.constraints.window のみ。
// 終了判定は evalWindowEnd (純粋核) へ委譲し、"ended" の連続2回観測で初めて止める (境界のちらつき対策)。
// unknown は streak を増やしも戻しもしない。停止は cancelMission (silent) を再利用し、条件終了の専用文を1回言う。
// 適用範囲は mission 実行中のみ (longtask/buildPlan 化した window 注文の終了監視は未対応・残件)。
function tickConditionWindow(bot, owner, r, ctx) {
  try {
    const win = r.mission?.status === "active" ? r.mission?.order?.constraints?.window : null;
    if (!win) { r.windowEndStreak = 0; return false; }
    const now = Date.now();
    if (now - (r.windowCheckAt || 0) < 3000) return false;
    r.windowCheckAt = now;
    const verdict = evalWindowEnd(win, { isRaining: typeof ctx?.env?.isRaining === "boolean" ? ctx.env.isRaining : undefined, isNight: typeof ctx?.env?.isNight === "boolean" ? ctx.env.isNight : undefined, isDawn: typeof ctx?.env?.isDawn === "boolean" ? ctx.env.isDawn : undefined, ownerHunger: typeof ctx?.owner?.hunger === "number" ? ctx.owner.hunger : undefined });
    if (verdict === "active") { r.windowEndStreak = 0; return false; }
    if (verdict !== "ended") return false; // unknown: 止めない・進めない
    r.windowEndStreak = (r.windowEndStreak || 0) + 1;
    if (r.windowEndStreak < 2) return false;
    const raw = win.raw || "その間";
    r.windowEndStreak = 0; r.windowCheckAt = 0;
    cancelMission(bot, owner, r, true);
    try { say(owner, bot, `${raw}は終わりました。指示はここまでにします。集めた分はそのままです`, true); } catch {}
    return true;
  } catch { return false; }
}
function tickMission(bot, owner, ctx, scan) {
  const r = rt(bot); const m = r.mission;
  if (!m || m.status !== "active") return false;
  /* forbids G6-a (cycle1058): 開始後に記録された禁止も実行中 mission の寄り道・引き出しゲートへ届ける (G6-b の longtask 和集合パターンの横展開)。
     和集合は単調増加のみ。G3 の解除が入ったら置換へ見直すこと */
  try { if (m.order) { const kind579 = m.order?.kind || "gather"; if (!Array.isArray(m.baseForbiddenTargets)) m.baseForbiddenTargets = deriveBaseForbiddenIds(m.order?.constraints?.forbiddenTargets, r.sessionForbids, kind579); const fbNow = recomputeForbiddenIds(m.baseForbiddenTargets, r.sessionForbids, kind579); m.order.constraints = { ...(m.order.constraints || {}), forbiddenTargets: fbNow }; } } catch {} // v0.5.79: 置換式の再計算 (旧コメントの「解除が入ったら置換へ見直す」を実施。base は注文由来のみ、セッション分は現行値で出し入れ)
  // 所持品が読めない時は「0個」と誤認して進めない（unknown を 0 と混同しない）
  if (ctx.x && ctx.x.invOk === false) {
    // cycle0033 F3: count consecutive unreadable on mission (persisted); suspend over limit; throttled noteFail
    const iuPrev = (typeof m.invUnreadObs === "number" && Number.isFinite(m.invUnreadObs) && m.invUnreadObs > 0) ? Math.floor(m.invUnreadObs) : 0;
    m.invUnreadObs = iuPrev + 1;
    if ((m.invUnreadObs - 1) % 120 === 0 && Date.now() - (r.invUnreadNoteAt || 0) >= 60000) { r.invUnreadNoteAt = Date.now(); noteFail(bot, "mission:inv_unreadable", new Error("inventory unavailable")); }
    if (m.invUnreadObs > 600) {
      m.status = "suspended"; m.suspendReason = "inv_unreadable"; m.suspendCount = (m.suspendCount || 0) + 1; m.suspendWaitSince = Date.now();
      noteFail(bot, "mission:inv_unreadable_suspended", new Error("inventory unavailable over limit"));
      persistMission(bot, r, true);
      return true;
    }
    return true;
  }
  if (m.invUnreadObs) m.invUnreadObs = 0; // readable tick resets the consecutive counter
  // 寄り道の機会走査（side ステップがある間だけ）
  r.sideTask = null;
  // TAKEBAN-PRUNE-SIDE-GATED / TAKEBAN-NO-RELEASE (cyc2364 A05, cyc2365 統合): prune は寄り道ステップ依存だったため通常経路で到達しなかった。常時経路へ移設し、在庫が満杯でなくなったら ban を一括解除する (最大60秒の盲窓解消)。
  try { if (r.takeBan) { pruneTakeBans(r.takeBan, Date.now()); if (ctx?.inv && !ctx.inv.full) clearAllTakeBans(r.takeBan); } } catch {}
  const sideSteps = m.steps.filter((s) => s.type === "side_collect" && s.status !== "done");
  if (sideSteps.length) {
    const sideOrders = sideSteps.map((s) => ({ item: s.target, amount: s.need, have: s.have || 0, target: s.target, label: nameOfItem(s.target) }));
    r.sideState.now = Date.now();
    try { pruneCooldowns(r.sideState, Date.now()); } catch {}
    try { r.sideTask = scanOpportunities(ctx, sideOrders, r.sideState); } catch {}
    // SIDE-COOLDOWN-CHASE (cycle1134): scan が幾何ゲートで外れても、接近中の候補実体が存続する間は保持する
    try {
      if (!r.sideTask && r.sideChase?.activeKey && r.sideHeldTask) {
        const held = r.sideHeldTask;
        const opp = (ctx?.x?.opportunities || []).find((o) => held.targetId ? o.id === held.targetId : (o.typeId === held.itemType && held.pos && Math.abs((o.pos?.x ?? 1e9) - held.pos.x) < 1 && Math.abs((o.pos?.z ?? 1e9) - held.pos.z) < 1));
        if (opp) { r.sideTask = { ...held, pos: { x: opp.pos.x, y: opp.pos.y, z: opp.pos.z } }; r.sideHeldTask = r.sideTask; }
      }
      if (r.sideTask) r.sideHeldTask = r.sideTask;
    } catch {}
  }
  const step = m.steps[m.currentStep];
  // 0-C2 読み手 (cycle1337): 実行中に記録された上限も狩猟ステップへ届ける (need を上限へ寄せれば advance が通常経路で完了させる)
  try { if (step && step.type === "hunt_entity") { const cpNow = capForTarget(mergeCaps(m.order?.constraints?.caps, r.caps), step.target, "hunt"); if (cpNow !== null && step.need > cpNow) step.need = cpNow; } } catch {}
  let ft = { found: false };
  if (step && (step.type === "gather_block" || step.type === "hunt_entity" || step.type === "side_collect")) {
    // 進捗が増えたら見切りタイマーをリセット。45秒進捗なしの対象は60秒避けて探し直す（到達不能な1個に固着しない）
    const curHave = step.have || 0;
    // Phase2 INSPECT Step 3b R4 (v0.4.13): 前tickの対象状態が unknown/pending なら、その経過分 (上限10秒) は測れていなかった時間として見切り時計へ算入しない
    const prevTS = r.mTargetState;
    if (r.mTargetSince && prevTS && (prevTS.state === "unknown" || prevTS.state === "pending") && prevTS.typeId === (step.target ?? null) && typeof prevTS.at === "number") { r.mTargetSince += Math.max(0, Math.min(Date.now() - prevTS.at, 10000)); }
    if (curHave !== r.mLastHave) { r.mLastHave = curHave; r.mTargetSince = Date.now(); }
    else if (r.mTargetLoc && r.mTargetSince && Date.now() - r.mTargetSince > 45000 && !(r.tunnel && r.tunnel.key === r.mTargetKey && Date.now() - r.tunnel.lastStepAt < 15000)) { /* v0.4.66: 掘り進めている間は見切らない */ r.mBanKey = (r.mTargetKind === "entity" && r.mTargetEntity?.id) ? (entityBanKey(r.mTargetEntity.id) || banKeyFor(r.mTargetLoc, r.mTargetType) || r.mTargetKey) : (banKeyFor(r.mTargetLoc, r.mTargetType) || r.mTargetKey); r.mBanUntil = Date.now() + 60000; r.mTargetLoc = null; r.mTargetKey = ""; r.mTargetSince = Date.now(); } // queue0-A bug2 (cycle1728): trunk-unit ban (was found-cell key, looped on same trunk) // HUNT-BAN-CELL-01 (cyc2385): 実体対象は ID 単位で ban (セルキーでは移動で即すり抜けた)
    // 目標の固定: 一度狙った対象は、消える/壊れるまで変えない（毎tickの最寄り再選択による上下動・迷走を断つ）
    if (r.mTargetLoc && missionTargetValid(bot, r)) ft = { found: true, kind: r.mTargetKind, loc: r.mTargetLoc, typeId: r.mTargetType, entity: r.mTargetEntity, fillItem: r.mTargetFillItem || undefined, mediumKind: r.mTargetMediumKind || undefined, stand: r.mTargetFillStand || undefined };
    else {
      ft = findMissionTarget(bot, r, scan, step, ctx.x?.obs ? ctx.x.obs.scan !== "ok" : ctx.x?.scanOk === false);
      if (ft.found && ft.loc && (isBanned(ft.loc, ft.typeId, r.mBanKey, r.mBanUntil, Date.now()) || isEntityBanned(r.mBanKey, r.mBanUntil, Date.now(), ft.entity?.id))) { // queue0-A bug2 (cycle1728) // HUNT-BAN-CELL-01 (cyc2385): 実体は ID で照合
        // v0.4.66: 一番近いものを避けている時は、調査結果から次に近いものを選ぶ (隣の鉱石を見落とさない)
        let alt = null; try { if (ft.kind === "block" && ft.typeId) alt = lookupSurvey(bot, [ft.typeId], r.mBanKey); } catch {}
        ft = alt ? { found: true, kind: "block", loc: alt.loc, typeId: alt.typeId, detail: { state: "present", via: "survey" } } : { found: false };
      }
    }
  }
  r.mFound = !!ft.found;
  try { r.mTargetState = { state: ft.found ? "present" : (ft.detail?.state || "absent"), typeId: step?.target || null, at: Date.now() }; } catch {} // Phase2 INSPECT Step 3a (v0.4.11): 対象状態の記録のみ (分岐は変えない、読み手移行は Step 3b)
  // Phase3 GOAP-lite 影評価 (v0.4.12→v0.4.14): gather ステップについて代替調達＋CRAFT/PLACE 計画を 5 秒間引きで計算し r.lastPlan へ記録するだけ (実行・分岐は変えない、Phase 4 の読み手用)。state は goap_state が三状態で構築する (99 番兵は廃止: near は存在=1、chest は中身実測の合算のみ)
  try {
    if (step && step.type === "gather_block" && step.target && Date.now() - (r.lastPlanAt || 0) > 5000) {
      r.lastPlanAt = Date.now();
      let containers = []; try { const wm = wmemOf(bot); if (wm?.knownContainers) containers = wm.knownContainers(bot.dimension.id); } catch {}
      const srcState = ft.found ? "present" : ((ft.detail?.state === "unknown" || ft.detail?.state === "pending") ? "unknown" : "absent");
      // NQ-01 P1 (v0.4.18): 同スコープの実測距離を影評価へ追加するだけ (新規走査なし、分岐不変)。
      // ft.kind==="item" はドロップ、"block" は採取源。"entity"/未発見は両方 null (UNKNOWN)
      let sourceDist = null, dropDist = null;
      if (ft.found && ft.loc) { const d = dist(bot.location, ft.loc); if (ft.kind === "item") dropDist = d; else if (ft.kind === "block") sourceDist = d; }
      const ev = buildEvaluationFromCtx(ctx, { target: step.target, need: Math.max(1, step.need || 1), have: step.have || 0, recipes: buildRecipes(WOOD_SPECIES[0]), containers, sourceStatus: srcState, now: Date.now(), sourceDist, dropDist });
      const res = goapPlan(ev.state, ev.goal, ev.actions);
      const psteps = res?.ok ? (res.actions || res.steps || []).map((a) => a.id || a) : [];
      r.lastPlan = { ok: !!res?.ok, reason: res?.ok ? null : (res?.reason || null), steps: psteps, cost: res?.ok ? (res.cost ?? null) : null, at: Date.now(), candKey: null, pk: psteps.some((s) => typeof s === "string" && (s.startsWith("CRAFT:") || s.startsWith("PLACE:") || s.startsWith("SMELT:"))) ? "craft" : "gather", unk: Array.isArray(ev.meta?.unknownReasons) ? ev.meta.unknownReasons.length : 0 };
      // Phase3 NQ-02 (v0.4.17): Goal述語の正式表現で現在目標を記録のみ (分岐・実行は変えない)。ev.state は flat GOAP state で、inv fact の有無が三状態を担う
      try { const gg = makeInvGoal(step.target, Math.max(1, step.need || 1), { source: "mission" }); r.lastGoal = gg ? { goal: gg, key: goalKey(gg), state: evalGoal(gg, ev.state), at: r.lastPlan.at } : null; } catch { r.lastGoal = null; }
      // Phase3 S1b前提工事 P1/P2 (v0.4.17→v0.4.19 残欠是正): 第一手の pre と計画時 factStatus/state を追加保持のみ (既存7フィールド不変、読み手は Phase4)。v0.4.19: 対を局所で完成させてから公開し、第一手が無い計画では a1:null を明示、snap へ対同一性の at を付ける (cycle1156/a05)
      try { const pair = buildP3Material(res, ev); r.lastPlan.a1 = pair.a1; r.lastPlan.snap = pair.snap ? { factStatus: pair.snap.factStatus, state: pair.snap.state, at: r.lastPlan.at, chest: pair.snap.chest ?? null, stationStatus: pair.snap.stationStatus ?? null, unknownFacts: Array.isArray(pair.snap.unknownFacts) ? pair.snap.unknownFacts : [] } : null; } catch { try { r.lastPlan.a1 = null; r.lastPlan.snap = null; } catch {} }
      // Phase3 P3本体化 (v0.4.24): 旧ゲート (S1a) の記録は廃止し、第一手ゲートの正は P3 のみとした。r.lastPlanGate フィールド自体は互換のため clearPlanRecords の null 代入でのみ保持する (書込み停止)
      // Phase3 S1b P3 (v0.4.19): applicable 三状態再確認ゲートを二重記録のみで併走させる (第一手の実 pre と snap だけを見る。既存ゲート・分岐・実行は不変、読み手化と旧経路削除は次サイクル以降)
      try { const g3 = evaluateFirstStepP3(r.lastPlan); const g3v = g3?.verdict || "unknown", g3r = g3?.reason || null; r.lastPlanGateP3 = { verdict: g3v, reason: g3r, firstStep: g3?.firstStep ?? null, at: r.lastPlan.at, checks: Array.isArray(g3?.checks) ? g3.checks : null, ...(g3v === "allow" ? { scope: g3r === "already_satisfied" ? "no_first_step" : "first_step_pre_at_plan_time" } : {}) }; } catch { r.lastPlanGateP3 = null; }
      // Phase3 S1b P4 (v0.4.20): Goal同一性の材料 goalKey を lastPlan へ追加保持し (r.lastGoal.key と同一 try 由来の値を対で入れる)、同一性再検証を記録のみで接続 (分岐・実行は不変、読み手化は G5/G7 と別段)。検証は計画生成直後の自己整合として行い、失敗時は null で stale 誤読を防ぐ
      try { r.lastPlan.goalKey = r.lastGoal?.key ?? null; const p4Now = Date.now(); const rv = revalidateP4(r.lastPlan, r.lastGoal?.key ?? null, p4Now); const rvv = rv?.verdict || "unknown", rvr = rv?.reason || null; r.lastPlanRevalP4 = { verdict: rvv, reason: rvr, firstStep: rv?.firstStep ?? null, at: p4Now, checks: rv?.checks ?? null, ...(rvv === "allow" ? { scope: "plan_identity_at_adoption" } : {}) }; } catch { r.lastPlanRevalP4 = null; }
      // Phase3 S1b P5 (v0.4.21): 合成レコードを記録のみで追加 (複写のみ・再計算なし。現行の P4 記録は生成直後の自己整合であり、採用時点の再検証の実働証拠ではない)
      try { r.lastPlanGateUnified = buildUnifiedRecord(r.lastPlanGateP3, r.lastPlanRevalP4, r.lastPlan.at); } catch { r.lastPlanGateUnified = null; }
      // Phase3 S1b P4拡張 (v0.4.22): sig/needRemain を追加保持し全項目再検証を記録のみで接続 (生成直後の自己整合。candKey は B2 (v0.4.27) で計画時点の containers snapshot から独立に導出し保持する (採用側の再選定との照合が証拠であり、値の複写はしない)。読み手化は解禁後)
      try { const nr = needRemainOf(Math.max(1, step.need || 1), step.have || 0); r.lastPlan.needRemain = nr; const firstId = Array.isArray(r.lastPlan.steps) && r.lastPlan.steps.length ? r.lastPlan.steps[0] : null; const sig = computePlanSig({ missionId: m?.id ?? "m", stepIndex: m?.currentStep ?? 0, stepType: step.type, target: step.target, need: Math.max(1, step.need || 1), goalKey: r.lastPlan.goalKey, firstStep: firstId }); r.lastPlan.sig = sig; let planCandKey = null; try { const pcand = selectWithdrawCandidate({ stepType: step.type, detour: m?.detour, blockedStatus: m?.blocked, need: step?.need, have: step?.have, now: r.lastPlan.at, cooldownUntil: r.withdrawCooldownUntil || 0, item: step.target, logBlockIds: LOG_BLOCK_IDS, containers, selfPos: bot.location, dim: bot.dimension.id, blockedKeys: (r.withdrawBlocked instanceof Set || Array.isArray(r.withdrawBlocked)) ? r.withdrawBlocked : [], stepIndex: m?.currentStep }); planCandKey = candKeyForFirstStep({ firstStep: firstId, stepTarget: step.target, stepIndex: m?.currentStep, cand: pcand }); } catch { planCandKey = null; } r.lastPlan.candKey = planCandKey; const fNow = Date.now(); const fv = revalidateFull(r.lastPlan, r.lastGoal?.key ?? null, fNow, { sig, needRemain: nr, candKey: planCandKey, stepTarget: step.target, safety: { missionActive: true, stepType: step.type, detour: !!m?.detour, mineLeg: !!r.mineLeg, invKnown: ctx.x?.obs ? ctx.x.obs.inv === "ok" : ctx.x?.invOk !== false, invFull: !!ctx.inv?.full, selfHpPct: ctx.self?.hpPct ?? null, targetKnown: ft.found ? true : ((ft.detail?.state || "absent") === "absent"), foundTarget: !!ft.found } }); const fvv = fv?.verdict || "unknown"; r.lastPlanRevalFull = { verdict: fvv, reason: fv?.reason || null, firstStep: fv?.firstStep ?? null, at: fNow, checks: fv?.checks ?? null, ...(fvv === "allow" ? { scope: "plan_identity_full_at_plan_time" } : {}) }; } catch { r.lastPlanRevalFull = null; }
      // Phase4 cb_trace plan配線 (v0.4.57): 影評価が揃った時点で計画要約を記録のみ (分岐・実行は不変、読み手は表示専用)。
      // 器側 dedup は末尾1件との比較のみで result/fail の挟み込みに弱いため、接続側にも seen キー (g|p|r) を持ち、記録成功時のみ前進させる (cycle2153-a02)
      try { const pev = mapPlanEvent(r.lastPlan, r.lastGoal); if (pev) { const pk = `${pev.g || ""}|${pev.p || ""}|${pev.r || ""}|${pev.fr?.m || ""}`; if (r.tracePlanSeen !== pk && r.trace?.record(pev)) r.tracePlanSeen = pk; } } catch {} // Phase4 trace R2 (cycle0855): seen キーへ plan 失敗理由を含める
      // Phase4 failAgg U1 R-1 影読み手 (cycle1421, a05設計): failRate の初の判断側読み手。ただし本段は記録のみ (shadow) で、計画・分岐には使わない。
      // 試行0の Action は載せない (未実測を 0% と誤読させない)。消費への昇格は次段でブレンド式と一緒に判断する
      try { if (r.failAgg) { const rates = {}; for (const ak of ["BREAK", "PLACE", "TAKE", "STORE", "WITHDRAW", "CRAFT", "SMELT"]) { const fr = failRate(r.failAgg, ak); if (fr && fr.trials > 0) rates[ak] = fr; } r.lastFailBlend = { at: Date.now(), rates, shadow: true }; } } catch {}
      // Phase6 UNKNOWN→INSPECT段1 (cycle1850, a05設計): UNKNOWN が計画を塞ぐ内訳を候補形で影記録 (分岐・実行・ゲートには使わない。読み手は 6-ML 層1 の source 限定・記録のみ接続のみ)
      try { r.lastPlanInspect = { ...deriveInspectNeeds({ planOk: !!res?.ok, planReason: res?.ok ? null : (res?.reason || null), factStatus: ev?.meta?.factStatus ?? null, stationStatus: ev?.meta?.stationStatus ?? null, firstPre: r.lastPlan?.a1?.pre ?? null, chestObserved: (ev?.meta?.chest && Number.isFinite(ev.meta.chest.observed)) ? ev.meta.chest.observed : null, target: step.target }), planOk: !!res?.ok, at: r.lastPlan.at }; } catch { r.lastPlanInspect = null; }
      // 6-ML INSPECT 層1 (cycle1940): 影記録の直後に source スコープ (via === "inspect_block_near") の need 先頭1件だけ inspectBlockNear へ渡し、EXP 記録を開始する。戻り値は分岐・実行・ゲートに使わない (記録のみ)。chest/station スコープは対象外
      try { const need1 = (r.lastPlanInspect?.needs || []).find((n) => n && n.via === "inspect_block_near" && typeof n.item === "string" && n.item); if (need1) inspectBlockNear(bot, r, need1.item); } catch {}
      // Phase6 INSPECT S0-1 (cycle0153): 記録専用カウンタ。別 try で1点だけ接続し、戻り値は分岐・計画・ゲートへ渡さない。clearPlanRecords には登録しない (mission 終了で集計が消えないため)
      try { if (!r.inspectAgg) r.inspectAgg = createInspectAgg(); recordInspectEval(r.inspectAgg, r.lastPlanInspect); } catch {}
    }
  } catch {}
  if (ft.found) { const key = ft.loc ? `${ft.loc.x},${ft.loc.y},${ft.loc.z}` : ""; if (key !== r.mTargetKey) { r.mTargetKey = key; r.mTargetSince = Date.now(); } r.mTargetLoc = ft.loc; r.mTargetType = ft.typeId; r.mTargetEntity = ft.entity || null; r.mTargetKind = ft.kind; if (ft.kind === "fill_medium") { if (ft.fillItem) r.mTargetFillItem = ft.fillItem; if (ft.mediumKind) r.mTargetMediumKind = ft.mediumKind; r.mTargetFillStand = ft.stand || null; } else { r.mTargetFillItem = null; r.mTargetMediumKind = null; r.mTargetFillStand = null; } }
  // Phase2 INSPECT Step 3c-2 (v0.4.34, U4): 位置スナップショットと距離・帰還判定を1つの try で確定させる。位置が読めなければ posKnown=false とし、捏造値ではなく既存定義 (nearestDist 不明=-1 / atReturn=false) で obs を作って advance へ届ける
  let rp = null, nearestDist = -1, posSnap = null, dimSnap = null, posKnown = true;
  try {
    posSnap = { x: bot.location.x, y: bot.location.y, z: bot.location.z };
    dimSnap = bot.dimension.id;
    rp = returnPoint(bot, owner, m);
    if (step?.type === "goto_area" && step.target && typeof step.target === "object") nearestDist = dist(posSnap, step.target);
    if (step?.type === "return" || step?.type === "deliver") nearestDist = dist(posSnap, rp);
    r.mAtReturn = dist(posSnap, rp) <= 3.2; // 到着信号は return/goto と共用の 3.2 を維持 (v0.4.79 で狭小化と deliverInRange 分離供給の双方を試行したが digdown E2E シナリオB が回帰したため不採用。帯域 2.6<d<=3.2 は applyDirective が毎tick target を張り続けて接近し、出口は mission deliver の trackStall が担保する)
  } catch { posKnown = false; nearestDist = -1; r.mAtReturn = false; posSnap = null; dimSnap = null; }
  // 原木の進捗 (0-D3 是正): 総称指定では全樹種を合算するが、樹種指定ではその樹種だけを数える (別樹種の所持・拾得で進捗しない)
  let invCounts = ctx.x?.items || {};
  if (step && (step.type === "gather_block" || step.type === "side_collect") && step.target) {
    const st = String(step.target).split(":").pop();
    if (st === "log" || st.endsWith("_log")) {
      invCounts = { ...invCounts, [step.target]: countLogsForTarget(invCounts, step.target, LOG_BLOCK_IDS) };
    }
  }
  // v0.4.66: 指示の実行中は、いる区画 (4×4 チャンク) を調査する。見つからなければ未調査の区画へ探しに行く
  let regionSearch = false, searchExhausted = false;
  try {
    if (surveyAvailable()) {
      const rg = regionOf(bot.location.x, bot.location.z);
      const cur = requestSurvey(bot.dimension.id, rg.rx, rg.rz, 2);
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) requestSurvey(bot.dimension.id, rg.rx + ox, rg.rz + oz, 1); // 隣の区画も、読み込まれている分だけ
      // 区画の中心に 20 秒いても調査が終わらない (チャンクが読み込まれない等) なら、調べ終えた扱いにして先へ進む
      const ex = r.exploreRegion;
      if (cur && ex && ex.rx === rg.rx && ex.rz === rg.rz && Math.hypot(bot.location.x - ex.x, bot.location.z - ex.z) < 12) {
        if (!r.exploreArrivedAt) r.exploreArrivedAt = Date.now();
        else if (Date.now() - r.exploreArrivedAt > 20000 && cur.doneMask !== 0xffff) { markSurveyDone(cur); noteFail(bot, "survey:region_incomplete", new Error(`${rg.rx},${rg.rz}`)); }
      } else r.exploreArrivedAt = 0;
      if (step && (step.type === "gather_block" || step.type === "side_collect") && !ft.found) {
        regionSearch = true;
        if (r.mineLeg) {
          // 地中素材の leg: 区画探索は開始区画のみ。全49区画が尽きるまで searchExhausted にならず、
          // tickBranchMine のゲート (!regionMode) が開かないため、開始区画の調査完了をもって
          // 「探し尽くした」とし、absent 確定 → 潜行へ進む (Step 3b の規則はゲート側で従来どおり効く)。
          const sc = step.searchCenter || bot.location;
          const sr = regionOf(sc.x, sc.z);
          searchExhausted = surveyDone(surveys.get(surveyKeyOf(bot.dimension.id, sr.rx, sr.rz)));
        } else {
          searchExhausted = !nextExploreRegion(bot.dimension.id, step.searchCenter || bot.location, bot.location);
        }
      }
    }
  } catch {}
  const wCand = buildWithdrawCandidate(bot, r, m, step);
  const obs = {
    regionSearch, searchExhausted,
    invCounts, kills: r.missionKills || 0, nearestDist,
    dangerDist: ctx.danger.nearestDist, pos: posSnap, dim: dimSnap,
    foundTarget: !!ft.found, foundSide: r.sideTask ? r.sideTask.itemType : null, sideContinuation: r.sideContinuation === true,
    selfHpPct: ctx.self.hpPct, invFull: ctx.inv.full, atReturn: r.mAtReturn, delivered: !!r.deliveredFlag, posKnown, // Step 3c-2: 位置が測れていない間は true にならない
    invKnown: ctx.x?.obs ? ctx.x.obs.inv === "ok" : ctx.x?.invOk !== false, dangerKnown: ctx.x?.obs ? ctx.x.obs.scan === "ok" : ctx.x?.scanOk !== false,
    withdrawCandidate: wCand, withdrawInRange: wCand ? dist(bot.location, { x: wCand.x + 0.5, y: wCand.y + 0.5, z: wCand.z + 0.5 }) <= WITHDRAW_RANGE : false,
    withdrawDist: (wCand && posKnown) ? dist(bot.location, { x: wCand.x + 0.5, y: wCand.y + 0.5, z: wCand.z + 0.5 }) : null,
    withdrawBlocked: r.withdrawBlocked instanceof Set ? [...r.withdrawBlocked] : [],
    targetState: ft.found ? "present" : (ft.detail?.state || "absent"), targetKnown: ft.found ? true : ((ft.detail?.state || "absent") === "absent"), // Step 3b: unknown/pending は targetKnown=false
  };
  r.deliveredFlag = false;
  // Phase3 S1b 採用tick記録 (v0.4.22, cycle1301 A18): advance 直前に現在 step から Goal キーを再生成して同一性を記録のみで再検証する (分岐・実行は不変、GOAP_ADOPT_S1B は不変)
  try { if (r.lastPlan && step && step.type === "gather_block" && step.target) { const ak = goalKey(makeInvGoal(step.target, Math.max(1, step.need || 1), { source: "mission" })); const aNow = Date.now(); const av = revalidateP4(r.lastPlan, ak, aNow); const avv = av?.verdict || "unknown"; r.lastPlanRevalAdopt = { verdict: avv, reason: av?.reason || null, firstStep: av?.firstStep ?? null, at: aNow, checks: av?.checks ?? null, ...(avv === "allow" ? { scope: "plan_identity_at_adoption_tick" } : {}) }; } } catch { r.lastPlanRevalAdopt = null; }
  // Phase3 S1b candKey採用側供給 (v0.4.23, cycle1315-a01 Phase A): 採用tickで Full 版再検証を記録のみで併走させる。candKey は実行系候補 wCand から withdrawKeyOf で作る現在側だけを供給し、計画側 (r.lastPlan.candKey) は読み取り専用 (自己充足=恒真式化を禁止)。計画側 candKey は B2 (v0.4.27) で結線済みであり、両側とも供給済み (計画側は読み取り専用・自己複写禁止)。分岐・実行は不変
  try { if (r.lastPlan && step && step.type === "gather_block" && step.target) { const ak = goalKey(makeInvGoal(step.target, Math.max(1, step.need || 1), { source: "mission" })); const aNow = Date.now(); const firstStep = Array.isArray(r.lastPlan.steps) && r.lastPlan.steps.length ? r.lastPlan.steps[0] : null; let aCandKey = null; try { aCandKey = candKeyForFirstStep({ firstStep, stepTarget: step.target, stepIndex: m?.currentStep, cand: wCand }); } catch { aCandKey = null; } /* B1 (v0.4.26): 射影は純粋関数へ (検証部込みで同値) */ const aSig = computePlanSig({ missionId: m?.id ?? "m", stepIndex: m?.currentStep ?? 0, stepType: step.type, target: step.target, need: Math.max(1, step.need || 1), goalKey: ak, firstStep }); const aNr = needRemainOf(Math.max(1, step.need || 1), step.have || 0); const aSafety = { missionActive: !!m && m.status === "active", stepType: step.type, detour: !!m?.detour, mineLeg: !!r.mineLeg, invKnown: ctx.x?.obs ? ctx.x.obs.inv === "ok" : ctx.x?.invOk !== false, invFull: !!ctx.inv?.full, selfHpPct: ctx.self?.hpPct ?? null, targetKnown: ft.found ? true : ((ft.detail?.state || "absent") === "absent"), foundTarget: !!ft.found, withdrawBlocked: obs.withdrawBlocked, cooldownUntil: r.withdrawCooldownUntil || 0 }; const fv = revalidateFull(r.lastPlan, ak, aNow, { sig: aSig, needRemain: aNr, candKey: aCandKey, stepTarget: step.target, safety: aSafety }); const fvv = fv?.verdict || "unknown"; r.lastPlanRevalFullAdopt = { verdict: fvv, reason: fv?.reason || null, firstStep: fv?.firstStep ?? null, at: aNow, checks: fv?.checks ?? null, ...(fvv === "allow" ? { scope: "plan_identity_full_at_adoption_tick" } : {}) }; } } catch { r.lastPlanRevalFullAdopt = null; }
  // Phase3 S1b SYN-1 (v0.4.45): 採用tick合成を記録のみで接続 (材料は当tickで揃う P3 (計画時点) と Full採用版のみ。計画時点の Full は自己整合のため合成相手にしない。分岐・実行は不変、読み手は解禁後の別版)
  try { if (r.lastPlan && step && step.type === "gather_block" && step.target) { r.lastPlanGateUnifiedAdopt = buildAdoptUnifiedRecord(r.lastPlanGateP3, r.lastPlanRevalFullAdopt, r.lastPlan.at); } } catch { r.lastPlanGateUnifiedAdopt = null; }
  // Phase3 READ-1 (v0.4.54): G-2 連続2回 allow の観測数え。入力は採用tick合成のみ、キーは (planAt, sig)。
  // not_allow/合成なし/キー欠落/非gather/例外では連続性を断つ (fail-closed)。観測時点では消費しない。
  let adoptCalls = 0, adoptPlanAt = null, adoptSig = null, adoptConj = null;
  try {
    if (GOAP_ADOPT_S1B) {
      const adoptRec = r.lastPlanGateUnifiedAdopt;
      adoptPlanAt = (typeof adoptRec?.at === "number" && Number.isFinite(adoptRec.at)) ? adoptRec.at : null;
      adoptSig = (typeof r.lastPlan?.sig === "string" && r.lastPlan.sig) ? r.lastPlan.sig : null;
      adoptConj = (adoptRec && typeof adoptRec.conjunction === "string") ? adoptRec.conjunction : null;
      if (step && step.type === "gather_block" && step.target && adoptPlanAt !== null && adoptSig !== null && adoptConj === "allow") {
        const prev = r.planAdoptSeen;
        adoptCalls = (prev && prev.at === adoptPlanAt && prev.sig === adoptSig && typeof prev.calls === "number") ? prev.calls + 1 : 1;
        r.planAdoptSeen = { at: adoptPlanAt, sig: adoptSig, calls: adoptCalls };
      } else {
        r.planAdoptSeen = (adoptPlanAt !== null && adoptSig !== null) ? { at: adoptPlanAt, sig: adoptSig, calls: 0 } : null;
        adoptCalls = 0;
      }
      const shieldUsed = !!(r.planAdoptShieldUsedFor && r.planAdoptShieldUsedFor.at === adoptPlanAt && r.planAdoptShieldUsedFor.sig === adoptSig);
      obs.planAdoptAllow = (adoptCalls >= 2 && !shieldUsed) ? true : false;
    }
  } catch { adoptCalls = 0; try { obs.planAdoptAllow = false; } catch {} try { r.planAdoptSeen = null; } catch {} }
  let d = null;
  try { d = advance(m, obs); } catch {}
  // Phase3 READ-1 (v0.4.54): G-1 第1層 採用会計 (転記のみ・再分類なし) + 消費記録。applyDirective より前に確定させる
  try {
    if (GOAP_ADOPT_S1B) {
      r.lastPlanAdoptEffect = { conjunction: adoptConj, hasRecord: !!r.lastPlanGateUnifiedAdopt, action: d?.action ?? null, reason: d?.reason ?? null, planShield: d?.planShield === true, planAt: adoptPlanAt, sig: adoptSig, calls: adoptCalls, discounted: adoptCalls >= 2, at: Date.now() };
      if (d?.planShield === true && adoptPlanAt !== null && typeof adoptSig === "string" && adoptSig) r.planAdoptShieldUsedFor = { at: adoptPlanAt, sig: adoptSig };
    }
  } catch {}
  // Phase4 cb_trace replan配線 (v0.4.60): suspend 遷移のみを記録専用で転記する (分岐・実行は不変)。
  // 接続点は advance 直後のここ1点のみ。tickMission の入口が active 限定のため、この位置で suspended: を
  // 見たことは「この tick の advance で新たに suspend した」ことと等価であり、追加ガードなしに1回だけ記録できる。
  try { if (typeof d?.reason === "string" && d.reason.startsWith("suspended:")) { const rev = mapReplanEvent(m, d); if (rev) r.trace?.record(rev); } } catch {}
  persistMission(bot, r);
  if (!d) return false;
  applyDirective(bot, owner, r, ctx, scan, d);
  // 鉱石 leg で周囲に見つからなければ、自分で潜って掘り進む（ブランチマイニング）
  if (step && step.type === "gather_block" && !ft.found && (ft.detail?.state || "absent") === "absent" && r.mineLeg && !d?.target?.regionMode) tickBranchMine(bot, owner, r, ctx); // v0.4.66: 区画探索が残っている間はそちらを優先 (探し尽くしたらブランチマイニング) // Step 3b: ブランチマインは absent 確定時のみ
  return true;
}
// ---------- 建築 ----------
function computeMissing(bot, owner, summary) {
  const invB = countInv(bot); // BLD-01 (cycle1133): 判定は設置・消費するリゼ単独の在庫で見る (主人所持との合算は gather→全量納品で在庫0に戻り設置不能になる)
  return Object.entries(summary).filter(([item, n]) => (invB[item] || 0) < n).map(([item, n]) => ({ item, amount: n - (invB[item] || 0) }));
}
function startBuild(bot, owner, r, name, cells, origin, gatherFirst) {
  const summary = Object.create(null);
  for (const cell of cells) { if (cell.skipCount) continue; const item = cell.item || resolveMaterialItem(cell.material); if (item) summary[item] = (summary[item] || 0) + 1; }
  // U5-2 (cyc2387, U5-0 ruling): allowOnly verb="build" の限定がある場合のみ、対象外の材料を含む建築を開始しない。verb:null / gather / hunt の限定では建築を止めない (過剰ブロック防止)
  try { const blockedBuildItem = Object.keys(summary).find((it) => isBuildAllowedByAllowOnly(r.allowOnly, it) === false); if (blockedBuildItem) { say(owner, bot, `その建築は開始できません。許可されている対象だけに限定されています`, true); return; } } catch {}
  const missing = computeMissing(bot, owner, summary);
  r.buildPlan = { name, cells, origin: { x: Math.floor(origin.x), y: Math.floor(origin.y), z: Math.floor(origin.z) }, dim: (() => { try { return owner?.dimension?.id || null; } catch { return null; } })(), idx: 0, placed: 0, skipped: [], stage: gatherFirst && missing.length ? "gather" : "build", missing, missingIdx: 0 }; // buildPlan次元ガード (cycle0821): 原点の次元は主人 (原点=主人位置) の完全IDで記録する
  r.buildStallKey = null; r.buildStallSince = 0; r.buildStallBest = null; r.buildDangerSince = null; r.buildDangerNoted = false; r.buildDimSince = null; r.buildDimNoted = false; r.buildProgressAt = Date.now(); r.buildProgressIdx = 0; r.buildProgressPlaced = 0; r.buildGatherProgIdx = 0; r.buildGatherProgInv = 0; r.buildUnknownSince = null; r.buildUnknownNoted = false; // 基礎 R-3 (v0.4.81, cycle0417-a04): 前の建築の stall/危険時計を持ち越さない + BUILD-HOLD-NOEXIT (cycle1343): 無進捗時計の起点 + GATHER-NOEXIT snapshot + F1 (cycle2200): buildUnknown も開始時に掃除する
  if (r.buildPlan.stage === "gather") { say(owner, bot, `承知しました。${name}ですね。材料が${missing.length}種、足りません。先に集めてきます`, true); startNextGather(bot, owner, r); }
  else say(owner, bot, `承知しました。${name}を建てます。場所は、あなたの今の位置です`, true);
}
function startNextGather(bot, owner, r) {
  const bp = r.buildPlan; if (!bp) return;
  const miss = bp.missing[bp.missingIdx];
  if (!miss) { bp.stage = "build"; say(owner, bot, `材料が揃いました。${bp.name}を建て始めます`, true); return; }
  say(owner, bot, `材料集めです。${nameOfItem(miss.item)}を${miss.amount}個、集めてきます`, true);
  const gatherStarted = startMission(bot, owner, r, { kind: "gather", target: miss.item, amount: miss.amount, constraints: { hostiles: "avoid", forbiddenTargets: (() => { try { return unionForbiddenIds([], r.sessionForbids, "gather"); } catch { return []; } })() }, sideTasks: [], returnTo: "owner", legsOnly: true }, false, { noLongTask: true }); // BLD-01 (cycle1133)
  if (!gatherStarted && !r.mission) foldGatherBuildPlan(bot, owner, r, "forbidden_gather", null); // cycle0117 G2 出口B: 禁止材料では建築材料集めを畳む: legsOnly で完了時の全量納品を止め、集めた材料をリゼが保持したまま build へ進む
}
function advanceBuildGather(bot, owner, r) { const bp = r.buildPlan; if (!bp || bp.stage !== "gather") return; bp.missingIdx++; startNextGather(bot, owner, r); }
// GATHER-NOEXIT (cycle1850-a07 -> cycle1909): gather 相にも無進捗の最終出口を持たせる。
// tickBuild の時計 (buildProgressAt) は startBuild が gather でも立てるが読み手が build 相にしか無く、
// 通常 suspend (cannot_recover 以外) では再開・期限の担い手も無いため gather 相が恒久化した。
// 進捗 = missingIdx の増加 or 現在の対象材料の所持数増加 (減少は snapshot 追随のみ、tickBuild と同型)。
function tickGatherNoProgress(bot, owner, r) {
  const bp = r.buildPlan; if (!bp || bp.stage !== "gather") return false;
  const nowG = Date.now();
  const miss = bp.missing?.[bp.missingIdx];
  let invN = 0; try { invN = miss ? (countInv(bot)[miss.item] || 0) : 0; } catch {}
  if (r.buildProgressAt == null) { r.buildProgressAt = nowG; r.buildGatherProgIdx = bp.missingIdx; r.buildGatherProgInv = invN; return false; }
  if (bp.missingIdx > (r.buildGatherProgIdx ?? 0) || invN > (r.buildGatherProgInv ?? 0)) { r.buildProgressAt = nowG; r.buildGatherProgIdx = bp.missingIdx; r.buildGatherProgInv = invN; return false; }
  if (nowG - r.buildProgressAt > BUILD_NO_PROGRESS_TIMEOUT_MS) {
    const dying = r.mission;
    const folded = foldGatherBuildPlan(bot, owner, r, "gather_no_progress", dying) || foldGatherBuildPlan(bot, owner, r, "gather_no_progress", null);
    if (folded && dying && dying.order?.legsOnly === true && dying.order?.target === miss?.item) { r.mission = null; clearPlanRecords(r); persistMission(bot, r, true); }
    return folded;
  }
  if (bp.missingIdx !== (r.buildGatherProgIdx ?? 0)) { r.buildGatherProgIdx = bp.missingIdx; r.buildGatherProgInv = invN; }
  else if (invN < (r.buildGatherProgInv ?? 0)) r.buildGatherProgInv = invN;
  return false;
}
function tickBuild(bot, owner, r, ctx) {
  const bp = r.buildPlan; if (!bp || bp.stage !== "build") return false;
  if (!bp.dim) { try { bp.dim = bot.dimension.id; } catch {} } // buildPlan次元ガード (cycle0821): dim 欠落の計画は現在次元を採用して捨てない (移行形)
  // BUILD-HOLD-NOEXIT (cycle1343, 案A): 無進捗の最終上限。進捗は idx/placed の増加のみ (距離短縮は数えない)。
  // 判定は次元・危険の両保留より前で、保留中も実時間で数える (stall 時計への保留差し引きは本時計に適用しない)。
  {
    const nowB = Date.now();
    if (r.buildProgressAt == null) { r.buildProgressAt = nowB; r.buildProgressIdx = bp.idx; r.buildProgressPlaced = bp.placed; } // 移行形: 起点なしの計画は今を起点にする
    else if (bp.idx > (r.buildProgressIdx ?? 0) || bp.placed > (r.buildProgressPlaced ?? 0)) { r.buildProgressAt = nowB; r.buildProgressIdx = bp.idx; r.buildProgressPlaced = bp.placed; }
    else if (nowB - r.buildProgressAt > BUILD_NO_PROGRESS_TIMEOUT_MS) {
      const hold = r.buildDimSince != null ? "dim" : (r.buildDangerSince != null ? "danger" : "none");
      try { say(owner, bot, `建築を中断しました。${bp.name}は、5分間進みませんでした。置いた${bp.placed}箇所は、そのまま残します`, true); } catch {}
      noteFail(bot, "place:build_no_progress_timeout", new Error(`build no progress 300s: hold=${hold} idx=${bp.idx}/${bp.cells.length} placed=${bp.placed}`));
      r.buildPlan = null; r.buildStallKey = null; r.buildStallSince = 0; r.buildStallBest = null; r.buildDangerSince = null; r.buildDangerNoted = false; r.buildDimSince = null; r.buildDimNoted = false; r.buildProgressAt = null; r.buildProgressIdx = null; r.buildProgressPlaced = null; r.buildUnknownSince = null; r.buildUnknownNoted = false;
      return true;
    }
    if (bp.idx < (r.buildProgressIdx ?? 0)) r.buildProgressIdx = bp.idx; // 減った場合はスナップショットだけ追随 (時刻は戻さない)
    if (bp.placed < (r.buildProgressPlaced ?? 0)) r.buildProgressPlaced = bp.placed;
  }
  if (bp.dim && bot.dimension.id !== bp.dim) {
    // buildPlan次元ガード (cycle0821): 別次元では設置・材料消費・skip記録を一切せず保留する (mineLeg次元ガードと同型、危険判定より前)
    if (r.buildDimSince == null) r.buildDimSince = Date.now();
    else if (!r.buildDimNoted && Date.now() - r.buildDimSince > 60000) { r.buildDimNoted = true; try { say(owner, bot, "建築の場所は、別の次元です。戻ったら、続けます", true); } catch {} noteFail(bot, "place:build_dim_hold", new Error("build held by dimension mismatch")); }
    r.target = { ...bot.location }; return true;
  }
  if (r.buildDimSince != null) { // 次元が戻った: 保留時間を stall 時計から差し引く (危険停止と同型)
    if (r.buildStallSince) r.buildStallSince += Math.max(0, Date.now() - r.buildDimSince); // cycle0740 BUILDSTALL-SHIFT-NEGGUARD
    r.buildDimSince = null; r.buildDimNoted = false;
  }
  if (ctx.danger.nearestDist < 5) {
    // 基礎 R-1 (v0.4.81, cycle0417-a05): 危険停止は維持するが無言・無記録にしない。
    // 連続60秒で1回だけ知らせる。停止時間は stall 時計から除外する (下の復帰分岐)。
    if (r.buildDangerSince == null) r.buildDangerSince = Date.now();
    else if (!r.buildDangerNoted && Date.now() - r.buildDangerSince > 60000) { r.buildDangerNoted = true; try { say(owner, bot, "危険が近くて、建築を止めています。離れたら、続けます", true); } catch {} noteFail(bot, "place:build_danger_hold", new Error("build held by danger over 60s")); }
    r.target = { ...bot.location }; return true;
  }
  if (r.buildDangerSince != null) { // 危険が去った: 停止していた時間を stall 時計から差し引く (R-2 形B の解消)
    if (r.buildStallSince) r.buildStallSince += Math.max(0, Date.now() - r.buildDangerSince); // cycle0740 BUILDSTALL-SHIFT-NEGGUARD
    r.buildDangerSince = null; r.buildDangerNoted = false;
  }
  while (bp.idx < bp.cells.length) {
    const cell = bp.cells[bp.idx];
    if (cell.skipCount) { bp.idx++; continue; }
    const item = cell.item || resolveMaterialItem(cell.material);
    if (!item) { bp.idx++; continue; }
    const pos = { x: bp.origin.x + (cell.dx ?? cell.x ?? 0), y: bp.origin.y + (cell.dy ?? cell.y ?? 0), z: bp.origin.z + (cell.dz ?? cell.z ?? 0) };
    let cur = null; try { cur = bot.dimension.getBlock(pos); } catch {}
    if (cur && cur.typeId === item) { bp.idx++; continue; }
    // N1-A (Phase4 failAgg, 裁定(a)): build skip 4地点は原則2の唯一の例外として commit のみ通す (noteFail は足さない)。設計: cycle2153-a04 §4 / cycle2229-a18
    // Phase2 PLACE build (v0.4.10): 未知セルは完了にも材料不足にもしない (三状態)
    if (!cur) { // cycle2117 CELL_UNKNOWN hold化: UNKNOWN を恒久 skip せず次元・危険保留と同型に保持する (idx/skipped/材料は進めない。出口は既存の無進捗300秒終端)
      if (r.buildUnknownSince == null) { r.buildUnknownSince = Date.now(); r.buildUnknownNoted = false; try { r.lastPlace = { act: "PLACE", mode: "build", ok: false, reason: "CELL_UNKNOWN", item, at: Date.now() }; commitLastAction(r, r.lastPlace); } catch {} }
      else if (!r.buildUnknownNoted && Date.now() - r.buildUnknownSince > 60000) { r.buildUnknownNoted = true; try { say(owner, bot, "セルの状態が分からず、建築を止めています。読み込めたら、続けます", true); } catch {} }
      r.target = { ...bot.location }; return true; }
    if (r.buildUnknownSince != null) { if (r.buildStallSince) r.buildStallSince += Math.max(0, Date.now() - r.buildUnknownSince); r.buildUnknownSince = null; r.buildUnknownNoted = false; }
    // Phase2 PLACE build: 非 air は上書きしない (L-15)
    if (cur.typeId !== "minecraft:air") { try { r.lastPlace = { act: "PLACE", mode: "build", ok: false, reason: "CELL_OCCUPIED", item, at: Date.now() }; commitLastAction(r, r.lastPlace); } catch {} bp.skipped.push({ item, reason: "CELL_OCCUPIED", pos }); bp.idx++; continue; }
    if (!hasItem(bot, item)) { try { r.lastPlace = { act: "PLACE", mode: "build", ok: false, reason: "NO_MATERIAL", item, at: Date.now() }; commitLastAction(r, r.lastPlace); } catch {} bp.skipped.push({ item, reason: "NO_MATERIAL", pos }); bp.idx++; continue; }
    r.target = { x: pos.x + 0.5, y: pos.y, z: pos.z + 0.5 };
    r.moveAct = "follow";
    const cellDist = dist(bot.location, { x: pos.x + 0.5, y: pos.y, z: pos.z + 0.5 }); // BLD1621-03: r.target と同じ中心基準に揃える (角基準だと最大0.707ずれる)
    if (cellDist > 3.4) {
      // Phase2 PLACE build 停滞検出 (v0.4.12) + 基礎 R-2 (v0.4.81, cycle0417-a04):
      // 見切りは「到達不能」にだけ使う。最良距離から 0.5 超の短縮がある間は
      // 進捗として時計を延長する (判定順は key変更→進捗→経過の順が必須)。
      // 真に近づけない場合は従来どおり 45 秒で skip する。
      const skey = bp.idx + ":" + pos.x + "," + pos.y + "," + pos.z;
      if (r.buildStallKey !== skey) { r.buildStallKey = skey; r.buildStallSince = Date.now(); r.buildStallBest = cellDist; }
      else if (r.buildStallBest == null || cellDist < r.buildStallBest - 0.5) { r.buildStallBest = cellDist; r.buildStallSince = Date.now(); }
      else if (Date.now() - (r.buildStallSince || 0) > 45000) { bp.skipped.push({ item, reason: "OUT_OF_RANGE", pos }); try { r.lastPlace = { act: "PLACE", mode: "build", ok: false, reason: "OUT_OF_RANGE", item, at: Date.now() }; commitLastAction(r, r.lastPlace); } catch {} noteFail(bot, "place:build_unreachable", new Error("build cell unreachable"), {expDone: true}); bp.idx++; r.buildStallKey = null; r.buildStallBest = null; }
      return true;
    }
    r.buildStallKey = null; r.buildStallBest = null;
    // PLACE-GATE段2 (cycle0522): 消費直前の設置ゲート (build のみ)。非placeは消費せず・setTypeせず・idxも進めない。出口は既存の300秒無進捗終端が担う
    { let gate = null; try { gate = evaluatePlace(digBlockAt(bot), { x: bot.location.x, y: bot.location.y + 1.6, z: bot.location.z }, pos, { reach: WORK_REACH, feetCell: { x: Math.floor(bot.location.x), y: Math.floor(bot.location.y), z: Math.floor(bot.location.z) }, selfCells: bodyCells(bot.location), ownerCells: bodyCells(owner.location), itemSolid: solidOfTypeId(item), via: "build" }); } catch { gate = { action: "hold", why: "gate_error" }; }
      if (gate && gate.action === "place") { try { if (r.buildGateHold) clearBuildGateHold(r.buildGateHold); if (r.buildGateSkipStreak) clearBuildGateSkipStreak(r.buildGateSkipStreak); } catch {} }
      if (!gate || gate.action !== "place") { try { r.lastPlaceHold = placeHoldRecord(gate || { action: "hold", why: "gate_error" }, { via: "build", at: Date.now() }); r.lastPlace = { act: "PLACE", mode: "build", ok: false, reason: "OUT_OF_RANGE", item, at: Date.now() }; commitLastAction(r, r.lastPlace); } catch {}
        // BUILD-GATE-HOLD (cycle0553): 同一セルの gate hold が累計45秒を超えたら、そのセルだけを skip して建築を進める (従来は近距離では45秒 skip 枝が無く300秒全体終端のみだった)
        // BUILD-FLOOR-SELF-01 (cyc2368, cyc2367 A11 是正候補2): 同一 why の GATE_HOLD skip が3セル連続したら、残りを45秒ずつ払わず建築全体を保留・報告する (skip の idx 増加が無進捗時計を延命し placed=0 のまま完了へ進む形の解消)
        try { if (!r.buildGateHold) r.buildGateHold = createBuildGateHoldState(); const gh = noteBuildGateHold(r.buildGateHold, { key: buildGateHoldKey(bp.idx, pos), why: gate?.why || "hold", nowMs: Date.now() }); if (gh.exhausted) { clearBuildGateHold(r.buildGateHold); bp.skipped.push({ item, reason: "GATE_HOLD", pos }); noteFail(bot, "place:build_gate_hold_exhausted", new Error(`build gate hold 45s: idx=${bp.idx} why=${gate?.why || "hold"}`), { expDone: true }); bp.idx++;
          if (!r.buildGateSkipStreak) r.buildGateSkipStreak = createBuildGateSkipStreakState(); const streak = noteBuildGateSkipStreak(r.buildGateSkipStreak, gate?.why || "hold");
          if (streak.exhausted) { clearBuildGateSkipStreak(r.buildGateSkipStreak); try { say(owner, bot, `建築を中断しました。同じ理由（${streak.why}）で置けない場所が続いています。置いた${bp.placed}箇所は、そのまま残します`, true); } catch {} noteFail(bot, "place:build_gate_hold_streak", new Error(`build gate hold streak: why=${streak.why} count=${streak.count} idx=${bp.idx}/${bp.cells.length} placed=${bp.placed}`), { expDone: true }); r.buildPlan = null; r.buildStallKey = null; r.buildStallSince = 0; r.buildStallBest = null; r.buildDangerSince = null; r.buildDangerNoted = false; r.buildDimSince = null; r.buildDimNoted = false; r.buildProgressAt = null; r.buildProgressIdx = null; r.buildProgressPlaced = null; r.buildUnknownSince = null; r.buildUnknownNoted = false; }
        } } catch {}
        return true; } }
    if (!takeFromInv(bot, item, 1)) { try { r.lastPlace = { act: "PLACE", mode: "build", ok: false, reason: "NO_MATERIAL", item, at: Date.now() }; commitLastAction(r, r.lastPlace); } catch {} bp.skipped.push({ item, reason: "NO_MATERIAL", pos }); bp.idx++; return true; }
    try {
      cur.setType(item);
      let placed = false; try { const rb = bot.dimension.getBlock(pos); placed = !!rb && rb.typeId === item; } catch {}
      if (placed) { bp.placed++; try { r.lastPlace = { act: "PLACE", mode: "build", ok: true, reason: null, item, at: Date.now() }; commitLastAction(r, r.lastPlace); } catch {} try { sfxPlace(bot.dimension, { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 }, item); } catch {} bp.idx++; return true; } // POLISH-SND-PLACE-01 (v0.4.90): 設置音
      throw new Error("build verify failed");
    } catch (err) {
      // Phase2 PLACE build: station/torch と同型に、消費後の設置失敗で材料を消失させない (ロールバック)
      try { const bc = invOf(bot); let rest = 1; if (bc) rest = addTo(bc, item, 1); if (rest > 0) bot.dimension.spawnItem(new ItemStack(item, rest), bot.location); } catch {}
      try { r.lastPlace = { act: "PLACE", mode: "build", ok: false, reason: "SET_FAILED", item, at: Date.now() }; commitLastAction(r, r.lastPlace); } catch {}
      noteFail(bot, "place:build_set_failed", err, {expDone: true});
      bp.skipped.push({ item, reason: "SET_FAILED", pos });
      bp.idx++;
      return true;
    }
  }
  const noMat = bp.skipped.filter((x) => x?.reason === "NO_MATERIAL").length;
  const otherSkip = bp.skipped.length - noMat;
  say(owner, bot, `${bp.name}、建て終わりました。${bp.placed}箇所、置きました。${noMat ? `材料不足で${noMat}箇所、空いています` : ""}${otherSkip ? `置けなかった場所が${otherSkip}箇所あります` : ""}`, true);
  r.buildPlan = null;
  r.buildStallKey = null; r.buildStallSince = 0; r.buildStallBest = null; r.buildDangerSince = null; r.buildDangerNoted = false; r.buildDimSince = null; r.buildDimNoted = false; r.buildProgressAt = null; r.buildProgressIdx = null; r.buildProgressPlaced = null; r.buildUnknownSince = null; r.buildUnknownNoted = false; // 基礎 R-3 (v0.4.81): 完了した建築の時計を残さない + BUILD-HOLD-NOEXIT (cycle1343) + F1 (cycle2200): hold 中のまま完了した場合も buildUnknown を残さない
  return true;
}
// ---------- 工場設計の提示 ----------
function tryFactoryRequest(p, bot, r, rawText) {
  if (!gateFactory(rawText).fire) return false;
  let goalItem = null;
  try { const o = parseOrder(rawText); if (o?.target?.item) goalItem = o.target.item; } catch {}
  if (!goalItem) for (const [alias, id] of Object.entries(GOAL_ALIASES)) { if (rawText.includes(alias)) { goalItem = id; break; } }
  if (!goalItem) { say(p, bot, "自動化の対象が分かりませんでした。対象の名前を入れて、もう一度どうぞ", true); return true; }
  const design = designFactory({ item: goalItem });
  if (!design) { say(p, bot, `${nameOfItem(goalItem)}の自動化は、レシピの記録がありません`, true); return true; }
  const simDesign = { ...design, power: { ...design.power, generators: [{ type: design.power.generator, count: design.power.generatorCount }], supplySEPerSec: design.power.gen / 60 } };
  const sim = simulate(simDesign);
  const chainNames = design.chain.filter((s) => s.role !== "generate").map((s) => nameOfItem(s.produces)).join(" → ");
  say(p, bot, `設計しました。工程は ${chainNames}。電力は消費 ${Math.round(design.power.use / 60)} SE/秒に対し発電 ${Math.round(design.power.gen / 60)} SE/秒。見込み生産は毎分 ${design.achievableRate} 個です`, true);
  if (!sim.ok) { const b = sim.bottlenecks?.[0]; say(p, bot, `ただし、このままでは回りません。${b?.detail || "要確認の箇所があります"}`, true); return true; }
  const built = layoutToBuild({ stages: design.chain.map((s) => ({ machine: s.block, count: s.count })), power: { generators: [{ type: design.power.generator, count: design.power.generatorCount }] }, storage: {} });
  startBuild(bot, p, r, `${nameOfItem(goalItem)}の自動化ライン`, built.cells, p.location, true);
  return true;
}
// ---------- 視線（第三レイヤーの最小実装: setRotation で対象を向く） ----------
// POLISH-ANIM-INSPECT-01 (cycle1003): 依頼品の全量取得成功時に検分の見下ろしを開始する (表示層のみ・実機確認待ち)
function noteInspectPickup(bot, r, ctx, typeId) {
  try {
    const ok = shouldInspect({ pickedTypeId: typeId, mission: r.mission ? { target: r.mission.order?.target } : null, longtask: r.longtask ? { target: r.longtask.target } : null, dangerCount: ctx?.danger?.count ?? null, dangerKnown: ctx?.x?.obs?.scan === "ok", lastFiredMs: r.inspectAnimLastAt ?? null, nowMs: Date.now() });
    if (ok) { r.inspectAnimAt = Date.now(); r.inspectAnimLastAt = r.inspectAnimAt; }
  } catch {}
}
// POLISH-ANIM-PORTALSTEADY-01 (cycle1640): 次元ID変化の辺 (2回連続観測で確定) でのみ発火を記録する (表示層のみ・実機確認待ち)
// POLISH-ANIM-SURFACEBREATH-01 (cycle1703): inWater source is bot.isInWater (c.x.inWater is never assigned)
function noteSurfacebreathTick(bot, r, c) {
  try {
    if (!bot || !r) return;
    if (!r.surfacebreathState) r.surfacebreathState = createSurfacebreathState();
    let inWater = false; try { inWater = !!bot.isInWater; } catch {}
    let rising = false; try { rising = bot.getVelocity().y > 0.05; } catch {}
    const prevFired = r.surfacebreathState.lastFiredAtMs;
    stepSurfacebreath(r.surfacebreathState, { inWater, rising, danger: !!(c?.danger && c.danger.count > 0), falling: r.selfFalling === true, hasWorkTarget: !!r.work, summonScanActive: isSummonScanActive(r.summonScanAt, Date.now()) }, Date.now());
    if (r.surfacebreathState.lastFiredAtMs !== prevFired && r.surfacebreathState.lastFiredAtMs !== null) r.lastSurfaceBreath = { at: r.surfacebreathState.lastFiredAtMs };
  } catch {}
}
// POLISH-ANIM-TOOLCHECK-01 (cycle1807): 連続待機45秒で一度だけ手元へ視線を落とす。待機の実測は「作業系が無く受動行動で、位置が1.5マス以内に留まっている」ことで数える (主人の不動時間や目標固定時間の流用はしない)。核は不変式のため返り値 state を必ず保存し直し、呼び出しはこの feeder 1か所だけ (表示層のみ・実機確認待ち)
// POLISH-FX-BUBBLEBREATH-01 (cycle1909): 水中滞在中の冷却排気泡。水中判定の正は bot.isInWater。
// 粒子ID未照合の間は spawnParticle を呼ばず r.lastBubbleBreath への記録のみ (表示層のみ・実機確認待ち)
function noteBubblebreathTick(bot, r, c) {
  try {
    if (!bot || !r) return;
    if (!r.bubblebreathState) r.bubblebreathState = createBubblebreathState();
    let inWater; try { inWater = bot.isInWater; } catch { inWater = undefined; }
    const res = stepBubblebreath(r.bubblebreathState, { inWater, danger: !!(c?.danger && c.danger.count > 0), falling: r.selfFalling === true, portalSteadyActive: isPortalsteadyActive(r.portalsteadyState, Date.now()) }, Date.now());
    if (res.fired) r.lastBubbleBreath = { at: Date.now(), count: r.bubblebreathState.fireCount, submergedMs: res.submergedMs };
  } catch {}
}
// POLISH-ANIM-WAKESTRETCH-01 (cycle0005): 長い待機 (60秒以上) の終了の辺でのみ小さな伸びを出す (表示層のみ・実機確認待ち)。
// 待機観測は noteToolCheckTick が維持する r.idleSinceMs を流用し新規観測は作らない。idleSinceMs が張り直された
// (アンカーから動いた) 場合は純粋核の時計も張り直すため、抑制つき辺消費で一度リセットしてから数え直す (cycle0005-a04)。
// 飛行 (ホバー待機が既定姿勢) は抑制に入れない: 入れると既定移動では到達不能になる (IDLE-01 と同じ倒し方)。
function noteWakestretchTick(bot, r, c) {
  try {
    if (!bot || !r) return;
    if (!r.wakestretchState) r.wakestretchState = createWakestretchState();
    const now = Date.now();
    const idle = r.idleSinceMs != null;
    if (idle && r.wakestretchSeenIdleSince !== r.idleSinceMs) {
      if (r.wakestretchState.idleSinceMs != null) noteWakestretch(r.wakestretchState, { idle: false, suppressed: true }, now); // 時計の張り直し: 辺を消費して数え直す
      r.wakestretchSeenIdleSince = r.idleSinceMs;
    }
    if (!idle) r.wakestretchSeenIdleSince = null;
    let inWater = false; try { inWater = !!bot.isInWater; } catch {}
    const res = noteWakestretch(r.wakestretchState, { idle, combat: !!(c?.danger && c.danger.count > 0), falling: r.selfFalling === true, inWater }, now);
    if (res && res.fired) { const cur = wakestretchCurrent(r.wakestretchState, now); r.lastWakestretch = { at: now, pitchDeg: cur.pitchDeg, yawDeg: cur.yawDeg, armPitchDeg: cur.armPitchDeg, episode: cur.episode }; } // 腕ピッチは記録のみ
  } catch {}
}
function noteToolCheckTick(bot, r, c) {
  try {
    if (!bot || !r) return;
    if (!r.toolcheckState) r.toolcheckState = createToolCheckState();
    const now = Date.now();
    const working = !!r.work || !!r.mission || !!r.longtask || !!r.buildPlan;
    const passiveAct = !r.moveAct || ["follow", "follow_close", "follow_high", "idle_hover", "stay_anchor"].includes(r.moveAct);
    let idleMs = 0;
    if (working || !passiveAct) { r.idleSinceMs = null; r.idleAnchor = null; }
    else {
      const p = bot.location;
      if (r.idleSinceMs == null || !r.idleAnchor || Math.hypot(p.x - r.idleAnchor.x, p.y - r.idleAnchor.y, p.z - r.idleAnchor.z) > 1.5) { r.idleSinceMs = now; r.idleAnchor = { x: p.x, y: p.y, z: p.z }; }
      idleMs = now - r.idleSinceMs;
    }
    let inWater = false; try { inWater = !!bot.isInWater; } catch {}
    const suppressed = working || !!(c?.danger && c.danger.count > 0) || r.selfFalling === true || inWater || isSummonScanActive(r.summonScanAt, now) || isPortalsteadyActive(r.portalsteadyState, now) || isFlinchActive(r.flinchAnimAt, now) || isInspectActive(r.inspectAnimAt, now);
    const out = tickToolCheck({ nowMs: now, idleMs, suppressed, state: r.toolcheckState });
    r.toolcheckState = out.state; r.toolcheckSample = out;
    if (out.fired) r.lastToolCheck = { at: now, idleMs, armPitchDeg: -28 }; // 腕ピッチは RP 受け口が無い間は記録のみ
  } catch {}
}
// POLISH-ANIM-IDLE-01 (cycle2020): 待機3秒から持続する待機モーション。待機の実測は noteToolCheckTick が維持する r.idleSinceMs を流用し新規観測は作らない。
// bodyY/傾けは受け口未整備の間 r.lastIdle 記録のみ、視線 (pitch) だけ applyGaze 最下位へ重畳する (表示層のみ・実機確認待ち)
function noteIdleTick(bot, r, c) {
  try {
    if (!bot || !r) return;
    if (!r.idleState) r.idleState = createIdleState();
    const now = Date.now();
    let inWater = false; try { inWater = !!bot.isInWater; } catch {}
    const rec = noteIdle(r.idleState, { idle: r.idleSinceMs != null, mode: "owner_wait", overlayActive: r.toolcheckSample?.active === true, inCombat: !!(c?.danger && c.danger.count > 0), falling: r.selfFalling === true, inWater }, now);
    const s = sampleIdle(r.idleState, now);
    if (s.active || rec?.entered) r.lastIdle = { atMs: now, mode: s.mode, bodyYOffsetBlocks: s.bodyYOffsetBlocks, headTiltDeg: s.headTiltDeg, gazePitchDeg: s.gazePitchDeg, entered: !!rec?.entered };
  } catch {}
}
// POLISH-ANIM-LOADPOSTURE-01 (cycle1832): 所持スロット占有率が 0.85 以上で3秒続くと前傾する。供給は既存の所持観測 (invOf) のみ・表示層のみ・実機確認待ち
function noteLoadPostureTick(bot, r, c) {
  try {
    if (!bot || !r) return;
    if (!r.loadpostureState) r.loadpostureState = createLoadPostureState();
    const now = Date.now();
    let ratio = null;
    try { const cont = invOf(bot); if (cont) { let used = 0; for (let i = 0; i < cont.size; i++) if (cont.getItem(i)) used++; ratio = cont.size > 0 ? used / cont.size : null; } } catch {}
    const sample = { ratio, working: !!r.work || !!r.mission || !!r.longtask || !!r.buildPlan, danger: !!(c?.danger && c.danger.count > 0), selfFalling: r.selfFalling === true, inWater: !!bot.isInWater }; // 注: ホバーはリゼの既定移動のため feeder では抑制に含めない (含めると常時抑制で到達不能になる。核側の別名受理は維持)
    noteLoadPosture(r.loadpostureState, sample, now);
    const s = sampleLoadPosture(r.loadpostureState, now);
    if (s.active) r.lastLoadPosture = { atMs: now, ratio: s.ratio, band: s.band };
  } catch {}
}
function notePortalsteadyTick(bot, dim, r, c) {
  try {
    if (!bot || !r) return;
    if (!r.portalsteadyState) r.portalsteadyState = { confirmedDim: null, candidateDim: null, candidateCount: 0, startedAtMs: null, lastFiredAtMs: null };
    let dimId = null; try { dimId = dim?.id || bot.dimension?.id || null; } catch {}
    if (!dimId) return;
    const prevDim = r.portalsteadyState.confirmedDim;
    const fired = notePortalsteady(r.portalsteadyState, { dimId, nowMs: Date.now(), danger: !!(c?.danger && c.danger.count > 0), falling: r.selfFalling === true, inWater: !!c?.x?.inWater, hasWorkTarget: !!r.work });
    if (fired) r.lastPortalSteady = { at: Date.now(), from: prevDim, to: dimId };
  } catch {}
}
// POLISH-ANIM-CATCHSIGHT-01 (cycle2200): 「主人が投げた物」の帰属束ね (位置だけの推定、全て AND、欠けたら不発)。
// 帰属は推定であり、他プレイヤーの投擲や近傍のモブドロップを誤認しうる (表示層のみ・無言・550ms のため許容し実機で頻度を見る)。
function isOwnerTossCandidate(bot, owner, r, loc) {
  try {
    if (!owner || !loc) return false;
    let sameDim = false; try { sameDim = bot.dimension.id === owner.dimension.id; } catch { return false; }
    if (!sameDim) return false;
    if (dist(owner.location, loc) > 4.0) return false; // 主人の手元付近に出現したものだけ
    if (dist(bot.location, loc) < 2.0) return false; // リゼ自身の spawnItem は全て自位置に出る
    try { const ort = ownerRt.get(owner.id); if (ort?.breakLoc && Date.now() - (ort.breakAt || 0) < 1500 && dist(ort.breakLoc, loc) <= 1.6) return false; } catch {} // 破壊ドロップは WORKGLANCE の管轄
    try { const dl = JSON.parse(wdp(`cb_death:${owner.id}`, "null")); if (dl && Date.now() - dl.t < 300000 && dist(dl, loc) <= 12) return false; } catch {} // 死亡ドロップは投擲ではない
    return true;
  } catch { return false; }
}
// POLISH-ANIM-CATCHSIGHT-01 (cycle2200): 抑制群の束ね (applyGaze の範囲で取れる実式のみ。取れない項目は false 固定)
function catchsightSuppressInput(bot, owner, ctx, gz, r, now) {
  try {
    const heedActive = !!(r.heedState && sampleHeed(r.heedState, now).active);
    const wgActive = !!(r.workglanceState && sampleWorkglance(r.workglanceState, now).active);
    const pcActive = !!(r.partnercheckState && partnerCheckOffset(r.partnercheckState, now).active);
    const llActive = !!(r.lookleadSample?.active && now - (r.lookleadSampleAt || 0) < 200);
    return {
      danger: (ctx?.danger?.count ?? 0) > 0,
      inCombat: gz?.gaze === "danger" || gz?.gaze === "danger_then_owner",
      hurtRecent: now - (r.lastDangerAt || 0) < 2000,
      working: !!r.work, digging: false, attacking: false, placing: false,
      falling: r.selfFalling === true, inWater: !!bot.isInWater, climbing: false,
      justTeleported: !!(r.portalsteadyState && isPortalsteadyActive(r.portalsteadyState, now)),
      justRespawned: false,
      flinchActive: isFlinchActive(r.flinchAnimAt, now),
      inspectActive: isInspectActive(r.inspectAnimAt, now),
      nodActive: isNodActive(r.nodAnimAt, now),
      heedActive, workglanceActive: wgActive,
      settleActive: isSettleActive(r.settleAnimAt, now),
      partnercheckActive: pcActive, lookleadActive: llActive,
      overlayActive: heedActive || wgActive || pcActive || llActive,
    };
  } catch { return { suppressed: true }; }
}
// POLISH-ANIM-SHIVER-01 (cyc2355): 寒冷地で待機しているときだけ小さく震える (表示層のみ・実機確認待ち)
// feeder は既存観測 (c.x.biome / c.x.selfFreezing) だけを使い新規走査なし。移動量は専用 prevPos で測る (warmhands と同方式)。
// 呼び出し位置は buildContext の return 直前が必須 (biome/selfFreezing は note 群より後に立つ。前に置くと cold が毎回 false で永遠に発火しない)
function noteShiverTick(bot, r, c) {
  try {
    if (!bot || !r) return;
    if (!r.shiverState) r.shiverState = createShiverState();
    const now = Date.now(); const p = bot.location;
    let stepDist = 0; if (r.shiverPrevPos) stepDist = Math.hypot(p.x - r.shiverPrevPos.x, p.z - r.shiverPrevPos.z); r.shiverPrevPos = { x: p.x, z: p.z };
    let inWater = false; try { inWater = !!bot.isInWater; } catch {}
    const out = noteShiverSample(r.shiverState, { cold: c?.x?.biome === "snow" || c?.x?.selfFreezing === true, busy: !!r.work || !!r.mission || !!r.longtask || !!r.buildPlan, moving: stepDist > 0.05, suppressed: !!((c?.danger?.count ?? 0) > 0) || r.selfFalling === true || inWater, nowMs: now });
    if (out?.fired) r.lastShiver = { at: now, fired: true };
  } catch {}
}
// POLISH-ANIM-WARMHANDS-01 (cycle0740): 火のそばで待機中、手をかざして温まる小さな仕草 (表示層のみ・実機確認待ち)
// feeder: nearHeat は知覚ライト走査の分類 (c.x.nearHeat)、待機は noteToolCheckTick の idleSinceMs、移動量は専用 prevPos で測る (新規走査なし)
function noteWarmhandsTick(bot, r, c) {
  try {
    if (!bot || !r) return;
    if (!r.warmhandsState) r.warmhandsState = createWarmhandsState();
    const now = Date.now(); const p = bot.location;
    let stepDist = 0; if (r.warmhandsPrevPos) stepDist = Math.hypot(p.x - r.warmhandsPrevPos.x, p.z - r.warmhandsPrevPos.z); r.warmhandsPrevPos = { x: p.x, z: p.z };
    let inWater = false; try { inWater = !!bot.isInWater; } catch {}
    const out = noteWarmhands(r.warmhandsState, { nearHeat: c?.x?.nearHeat === true, idle: r.idleSinceMs != null, stepDist, working: !!r.work || !!r.mission || !!r.longtask || !!r.buildPlan, danger: !!((c?.danger?.count ?? 0) > 0), falling: r.selfFalling === true, inWater }, now);
    if (out?.fired) r.lastWarmhands = { at: now, fired: true, armPitchDeg: -30 };
  } catch {}
}
// POLISH-ANIM-VILLAGERGREET-01 (cycle0855): 村人とすれ違うときの小さな会釈 (表示層のみ・実機確認待ち)
// feeder は既存エンティティ走査の最寄り村人候補 (r.villagerCand) だけを使い、新規走査はしない (方式B: cycle0855-a10)
function noteVillagergreetTick(bot, r, c) {
  try {
    if (!bot || !r) return;
    if (!r.villagergreetState) r.villagergreetState = createVillagergreetState();
    const cand = r.villagerCand || null;
    let relYaw = null;
    if (cand) { try { const gr = gazeRotation(bot.location, { x: cand.loc.x, y: cand.loc.y + 1.4, z: cand.loc.z }); const cur = bot.getRotation(); relYaw = ((gr.y - (cur?.y || 0) + 540) % 360) - 180; } catch {} }
    let inWater = false; try { inWater = !!bot.isInWater; } catch {}
    const out = noteVillagergreet(r.villagergreetState, { villagerId: cand ? cand.id : null, villagerDist: cand ? cand.d : null, villagerRelYawDeg: relYaw, scanOk: r.villagerScanOk === true, danger: !!((c?.danger?.count ?? 0) > 0), working: !!r.work || !!r.mission || !!r.longtask || !!r.buildPlan, falling: r.selfFalling === true, inWater }, Date.now());
    if (out?.fired) r.lastVillagerGreet = { at: Date.now(), villagerId: cand?.id || null };
  } catch {}
}
// POLISH-ANIM-ORESPOT-01 (cycle0832): 通りがかりの貴重鉱石へ一度だけする二度見 (表示層のみ・実機確認待ち)
// feeder は既存知覚 (percTargets.ore + perc.oreValuable) だけを使い、新規走査はしない
function noteOrespotTick(bot, r, c) {
  try {
    if (!bot || !r) return;
    if (!r.orespotState) r.orespotState = createOreSpotState();
    const t = (r.perc?.oreValuable && r.percTargets?.ore) ? r.percTargets.ore : null;
    let cellKey = null, relYaw = null, relPitch = null, isWork = false;
    if (t) {
      cellKey = `${t.x},${t.y},${t.z}:${t.typeId}`;
      try { const gr = gazeRotation(bot.location, { x: t.x + 0.5, y: t.y + 0.5, z: t.z + 0.5 }); const cur = bot.getRotation(); relYaw = ((gr.y - (cur?.y || 0) + 540) % 360) - 180; relPitch = gr.x - (cur?.x || 0); } catch {}
      if (r.work && r.work.loc.x === t.x && r.work.loc.y === t.y && r.work.loc.z === t.z) isWork = true;
    }
    let inWater = false; try { inWater = !!bot.isInWater; } catch {}
    const suppressed = !!((c?.danger?.count ?? 0) > 0) || r.selfFalling === true || inWater;
    const out = noteOreSpot(r.orespotState, { cellKey, relYawDeg: relYaw, relPitchDeg: relPitch, isCurrentWorkTarget: isWork, scanOk: !!r.perc, suppressed }, Date.now());
    if (out) r.lastOreSpot = { at: Date.now(), cellKey: out.cellKey };
  } catch {}
}
// POLISH-ANIM-SLEEPWATCH-01 (cycle0910): feeder は既存観測 (c.x.ownerInBed / c.self.distOwner / c.owner.dimensionSame) だけを使い新規走査なし。
// 就寝状態は buildContext が owner.isSleeping (正式版API) から供給済み。状態は純粋核が新しい state を返すため代入で保持する (揮発のみ)。
function noteSleepwatchTick(bot, r, c) {
  try {
    if (!bot || !r) return;
    if (!r.sleepwatchState) r.sleepwatchState = createSleepwatchState();
    let inWater = false; try { inWater = !!bot.isInWater; } catch {}
    const suppressed = !!((c?.danger?.count ?? 0) > 0) || r.selfFalling === true || inWater || !!r.work;
    const d = c?.self?.distOwner;
    const out = noteSleepwatch(r.sleepwatchState, { nowMs: Date.now(), ownerSleeping: c?.x?.ownerInBed === true, ownerDist: typeof d === "number" && Number.isFinite(d) && d < 900 ? d : null, sameDimension: c?.owner?.dimensionSame === true, suppressed, overlayActive: false });
    r.sleepwatchState = out.state;
    if (out?.fired) r.lastSleepWatch = { at: Date.now(), dist: typeof d === "number" ? d : null };
  } catch {}
}
// POLISH-ANIM-WAKEGREET-01 (cyc1939): feeder は既存観測だけを使い新規走査なし。就寝確定 (2回連続) 後の起床確定でのみ発火し、SLEEPWATCH (就寝開始の辺) とは発火源が別。
function noteWakegreetTick(bot, r, c) {
  try {
    if (!bot || !r) return;
    if (!r.wakegreetState) r.wakegreetState = createWakegreetState();
    let inWater = false; try { inWater = !!bot.isInWater; } catch {}
    const suppressed = !!((c?.danger?.count ?? 0) > 0) || r.selfFalling === true || inWater || !!r.work;
    const d = c?.self?.distOwner;
    const out = noteWakegreet(r.wakegreetState, { nowMs: Date.now(), ownerSleeping: c?.x?.ownerInBed === true ? true : (c?.x?.ownerInBed === false ? false : null), ownerDist: typeof d === "number" && Number.isFinite(d) && d < 900 ? d : null, sameDimension: c?.owner?.dimensionSame === true, suppressed });
    r.wakegreetState = out.state;
    if (out?.fired) r.lastWakegreet = { at: Date.now(), dist: typeof d === "number" ? d : null };
  } catch {}
}
// POLISH-ANIM-MOUNTGLANCE-01 (cycle0936): feeder は既存観測 (c.x.ownerRiding / c.self.distOwner / c.owner.dimensionSame) だけを使い新規走査なし。
function noteMountglanceTick(bot, r, c) {
  try {
    if (!bot || !r) return;
    if (!r.mountglanceState) r.mountglanceState = createMountglanceState();
    let inWater = false; try { inWater = !!bot.isInWater; } catch {}
    const suppressed = !!((c?.danger?.count ?? 0) > 0) || r.selfFalling === true || inWater || !!r.work;
    const d = c?.self?.distOwner;
    const out = noteMountglance(r.mountglanceState, { nowMs: Date.now(), ownerRiding: c?.x?.ownerRiding === true, ownerDist: typeof d === "number" && Number.isFinite(d) && d < 900 ? d : null, sameDimension: c?.owner?.dimensionSame === true, suppressed });
    r.mountglanceState = out.state;
    if (out?.fired) r.lastMountGlance = { at: Date.now(), dist: typeof d === "number" ? d : null };
  } catch {}
}
// POLISH-ANIM-HOMESIGHT-01 (cycle0900): feeder は既存 ctx.home (dist/registered/dimensionSame) だけを使い新規走査なし
function noteHomesightTick(bot, r, c) {
  try {
    if (!bot || !r) return;
    if (!r.homesightState) r.homesightState = createHomesightState();
    let inWater = false; try { inWater = !!bot.isInWater; } catch {}
    const suppressed = !!((c?.danger?.count ?? 0) > 0) || r.selfFalling === true || inWater;
    const out = noteHomesight(r.homesightState, { distHome: c?.home?.dist ?? null, homeRegistered: c?.home?.registered === true, dimensionSame: c?.home?.dimensionSame === true, suppressed }, Date.now());
    if (out?.fired) r.lastHomesight = { at: Date.now(), dist: c?.home?.dist ?? null };
  } catch {}
}
function applyGaze(bot, owner, ctx, scan) {
  try { const bv = typeof bot.isValid === "function" ? bot.isValid() : bot.isValid; if (bot.isValid !== undefined && !bv) return; if (owner) { const ov = typeof owner.isValid === "function" ? owner.isValid() : owner.isValid; if (owner.isValid !== undefined && !ov) return; } } catch { return; }
  // POLISH-ANIM-OWNERRETURN-01 (cycle1923): 主人の距離遷移だけを発火源にする feeder (表示層のみ・実機確認待ち)
  try { const r0 = rt(bot); if (!r0.ownerreturnState) r0.ownerreturnState = createOwnerReturnState(); const d = ctx?.self?.distOwner; const same = !!owner && !!ctx?.owner?.dimensionSame; let relYaw = 0; try { const gr = gazeRotation(bot.location, { x: owner.location.x, y: owner.location.y + 1.4, z: owner.location.z }); const cur = bot.getRotation(); relYaw = ((gr.y - (cur?.y || 0) + 540) % 360) - 180; } catch {} const rec = noteOwnerReturn(r0.ownerreturnState, { dist: same && Number.isFinite(d) && d < 900 ? d : null, busy: !!r0.work || r0.selfFalling === true, targetYawDeg: relYaw }, Date.now()); if (rec) r0.lastOwnerReturn = r0.ownerreturnState.lastRecord; } catch {}
  try { const r0 = rt(bot); if (!r0.doubletakeState) r0.doubletakeState = createDoubletakeState(); const d = ctx?.self?.distOwner; const same = !!owner && !!ctx?.owner?.dimensionSame; const dres = noteDoubletake(r0.doubletakeState, { ownerPresent: !!owner, dist: same && Number.isFinite(d) ? d : null, sameDimension: same }, Date.now(), !!((ctx?.danger?.count ?? 0) > 0) || r0.selfFalling === true || !!r0.work); if (dres === "fired") r0.lastDoubletake = { at: Date.now() }; } catch {} // POLISH-ANIM-DOUBLETAKE-01 (cycle0403) feeder: 既存観測 ctx.self.distOwner のみ (新規走査なし)。0-C6(c) (cycle1256): r0/d/same を自ブロック内で宣言 (従来は直前 try のスコープ外参照で常時 ReferenceError→空catch 握りつぶしだった)
  try { const r0 = rt(bot); if (!r0.darkentryState) r0.darkentryState = darkEntryInit(); const band = lightBandOf(ctx?.x?.lightLevel); if (band !== null) { const de = noteDarkEntry(r0.darkentryState, { band, nowMs: Date.now(), inCombat: (ctx?.danger?.count ?? 0) > 0, falling: r0.selfFalling === true, inWater: !!bot.isInWater }); r0.darkentryState = de.state; if (de.fired) r0.lastDarkEntry = { at: Date.now(), band }; } } catch {} // POLISH-ANIM-DARKENTRY-01 (cycle0423) feeder: 既存の合成 lightLevel のみ (新規走査なし)
  // POLISH-ANIM-MUSICNOD-01 feeder (cycle2006): 音楽ブロック近傍滞在を代理条件とする (再生事実は正式版APIで取れない)。
  // 0-D4 分離 (cycle1514): 演出側は scanCachePeek の読み取り専用に限定し、scanBlockNear を一切呼ばない。
  // これにより演出の検索が mScanMap の failedCells (資源探索の失敗カウンタ) へ書き込む経路が消える。
  // キャッシュが stale/unknown のときは near=undefined (不明) とし、演出のために走査を起こさない。
  try { const r0 = rt(bot); if (!r0.musicnodState) r0.musicnodState = createMusicnodState(); if (Date.now() - (r0.musicnodCheckAt || 0) >= 2000) { r0.musicnodCheckAt = Date.now(); let near; let src = null; try { const pj = scanCachePeek(r0, "minecraft:jukebox"); const pn = pj.state === "hit" ? null : scanCachePeek(r0, "minecraft:noteblock"); if (pj.state === "hit") { near = true; src = "jukebox"; } else if (pn && pn.state === "hit") { near = true; src = "note_block"; } else if (pj.state === "absent" && pn && pn.state === "absent") near = false; else near = undefined; /* 0-D4 (cycle1256): 音符ブロックの実IDは minecraft:noteblock (アンダースコアなし)。記録ラベル src は不変 */ } catch { near = undefined; } const rec = noteMusicnod(r0.musicnodState, { nearMusic: near, source: src, inCombat: (ctx?.danger?.count ?? 0) > 0, falling: r0.selfFalling === true, inWater: !!bot.isInWater, working: !!r0.work, ownerFar: typeof ctx?.self?.distOwner === "number" && ctx.self.distOwner > 16 }, Date.now()); if (rec?.entered) r0.lastMusicNod = { at: Date.now(), source: src, fired: true }; } } catch {}
  // POLISH-ANIM-STAIRSLOOK-01 feeder (cycle1514): 足元フロア高の ±1 変化だけを段差として供給する (新規走査なし)。
  // 飛行中の高度変化と混同しないよう selfFalling/水中/戦闘/作業中は純粋核側の抑制に委ね、ここでは落下中を渡す。
  try { const r0 = rt(bot); if (!r0.stairlookState) r0.stairlookState = createStairLookState(); const fy = Math.floor(bot.location?.y ?? NaN); if (Number.isFinite(fy)) { if (typeof r0.stairPrevFloorY === "number" && fy !== r0.stairPrevFloorY) { const d = fy - r0.stairPrevFloorY; let flying = false; try { flying = bot.isFlying === true; } catch {} if ((d === 1 || d === -1) && !flying) { const rec = noteStairLook(r0.stairlookState, { stepDir: d, combat: (ctx?.danger?.count ?? 0) > 0, falling: r0.selfFalling === true, inWater: !!bot.isInWater, working: !!r0.work }, Date.now()); if (rec?.fired) r0.lastStairLook = { at: Date.now(), dir: d }; } } r0.stairPrevFloorY = fy; } } catch {}
  // POLISH-ANIM-TORCHPASS-01 feeder 第1段 (cycle1532): 候補は scanCachePeek の読み取り専用のみ (0-D4 分離の作法。新規走査なし)。
  // 発火は r.lastTorchPass への記録のみで視線へは重畳しない。頻度を実機ログで見てから第2段 (重畳) を判断する。
  // flying/hurt は渡さない (ホバー既定で flying を渡すと恒常抑制になり永遠に発火しない。A04 監査)。
  try { const r0 = rt(bot); if (!r0.torchpassState) r0.torchpassState = createTorchPassState(); if (!r0.gazeReplayCall && Date.now() - (r0.torchpassCheckAt || 0) >= 1000) { r0.torchpassCheckAt = Date.now(); const TP_IDS = [["minecraft:torch", "torch"], ["minecraft:wall_torch", "torch"], ["minecraft:soul_torch", "torch"], ["minecraft:soul_wall_torch", "torch"], ["minecraft:lantern", "lantern"], ["minecraft:soul_lantern", "lantern"], ["minecraft:glowstone", "glowstone"], ["minecraft:lit_redstone_lamp", "lamp_lit"]]; let best = null; for (const [tid, cat] of TP_IDS) { const pk = scanCachePeek(r0, tid); if (pk.state === "hit" && pk.loc) { const dd = dist(bot.location, pk.loc); if (Number.isFinite(dd) && (!best || dd < best.dist)) best = { loc: pk.loc, cat, dist: dd }; } } const sample = { lightLevel: ctx?.x?.lightLevel, combat: (ctx?.danger?.count ?? 0) > 0, working: !!r0.work, falling: r0.selfFalling === true, inWater: !!bot.isInWater }; if (best) { sample.category = best.cat; sample.clusterKey = `tp:${best.loc.x},${best.loc.y},${best.loc.z}`; sample.dist = best.dist; try { const gr = gazeRotation(bot.location, { x: best.loc.x + 0.5, y: best.loc.y + 0.5, z: best.loc.z + 0.5 }); const cur = bot.getRotation(); sample.bearingDeg = ((gr.y - (cur?.y || 0) + 540) % 360) - 180; } catch {} } const rec = noteTorchPass(r0.torchpassState, sample, Date.now()); if (rec?.fired) r0.lastTorchPass = { at: Date.now(), category: best?.cat || null, clusterKey: best ? `tp:${best.loc.x},${best.loc.y},${best.loc.z}` : null }; } } catch {}
  // POLISH-ANIM-EATGLANCE-01 feeder: 実時間の isEating() を供給する。再演 (gazeReplayCall) を除外しないこと
  // — 除外すると CONFIRM_COUNT=2 に届かず永久に発火しない (torchpass の間引き式を流用しない)。
  try { const r0 = rt(bot); if (!r0.eatglanceState) r0.eatglanceState = createEatGlanceState();
    let eating = false; try { eating = !!equipCoreOf(bot, r0)?.isEating(); } catch {}
    const src = r0.eatglanceSrc;
    const kind = eating && src && (Date.now() - src.at) < (src.eatMs || 1600) + 500 ? src.kind : null;
    const out = noteOwnEating(r0.eatglanceState, { eating, kind, nowMs: Date.now(),
      suppressed: !!((ctx?.danger?.count ?? 0) > 0) || r0.selfFalling === true || !!bot.isInWater || !!r0.work,
      overlayActive: false });
    if (out?.fired) r0.lastEatGlance = { at: Date.now(), kind: out.kind, item: src?.item || null }; } catch {}
  let gz = null; try { gz = decideGaze(ctx); } catch {}
  if (!gz) return;
  const r = rt(bot);
  let look = null;
  if (gz.gaze === "danger" || gz.gaze === "danger_then_owner") look = scan?.nearestHostile?.location || owner.location;
  else if (gz.gaze === "home") { const h = homeOf(bot); look = h ? { x: h.x, y: h.y, z: h.z } : owner.location; }
  else if (gz.gaze === "work_target" && r.work) look = r.work.loc;
  else if (gz.gaze === "nearest_item" && scan?.nearestItem) look = scan.nearestItem.location;
  else look = owner.location; // owner_face / owner_hands / owner_feet / drift 等は主人方向を既定に
  if (look) {
    // POLISH-ANIM-LOOK-01 (cycle0821): ピッチも対象へ連動させる (従来は x:0 固定で上下の対象を見なかった)。表示層のみ・実機確認待ち
    const cellTarget = gz.gaze === "work_target" || gz.gaze === "home";
    const tp = { x: look.x, y: look.y + (cellTarget ? 0.5 : 1.4), z: look.z };
    let rot = gazeRotation(bot.location, tp);
    // POLISH-ANIM-WORKGLANCE-01 (cycle1728, v0.5.19): owner break/place event edge -> brief glance (display only, real-machine check pending)
    try { if (!r.workglanceState) r.workglanceState = createWorkglanceState(); const ort = owner ? ownerRt.get(owner.id) : null; const evs = []; if (ort?.breakLoc && (ort.breakAt||0) > (r.workglanceSeenAt||0)) evs.push({ kind: "break", loc: ort.breakLoc, at: ort.breakAt }); if (ort?.placeLoc && (ort.placeAt||0) > (r.workglanceSeenAt||0)) evs.push({ kind: "place", loc: ort.placeLoc, at: ort.placeAt }); evs.sort((a,b)=>a.at-b.at); for (const ev of evs) { r.workglanceSeenAt = ev.at; const fired = noteWorkglance(r.workglanceState, { nowMs: Date.now(), selfPos: bot.location, eventPos: ev.loc, eventKind: ev.kind, selfYawDeg: rot ? rot.y : null, working: !!r.work, danger: !!((ctx?.danger?.count ?? 0) > 0), falling: r.selfFalling === true, inWater: !!bot.isInWater, sameDimension: (()=>{ try { return bot.dimension.id === owner.dimension.id; } catch { return false; } })() }); if (fired) r.lastWorkglance = { at: Date.now(), kind: ev.kind }; } } catch {}
    // POLISH-ANIM-CATCHSIGHT-01 (cycle2200): feeder — キューを全件 drain し辺を1回だけ消費する (遅れ発火防止)
    try { if (!r.catchsightState) r.catchsightState = createCatchsightState(); const pend = Array.isArray(r.catchsightPending) ? r.catchsightPending : []; r.catchsightPending = []; const now = Date.now(); const sup = catchsightSuppressInput(bot, owner, ctx, gz, r, now); for (const ev of pend) { if (!ev?.loc || now - (ev.at || 0) > 1500) continue; let sameDim = false; try { sameDim = !!owner && bot.dimension.id === owner.dimension.id; } catch {} if (!sameDim) continue; const gr = gazeRotation(bot.location, { x: ev.loc.x, y: ev.loc.y, z: ev.loc.z }); const relYaw = gr && rot ? ((gr.y - rot.y + 540) % 360) - 180 : null; const relPitch = gr && rot ? gr.x - rot.x : null; const d3 = dist(bot.location, ev.loc); const fired = noteCatchsight(r.catchsightState, { ownerTossedItem: true, itemDistance: d3, itemRelYawDeg: relYaw, itemRelPitchDeg: relPitch, ...sup, nowMs: now }, now); if (fired) r.lastCatchSight = { at: now, dist: d3, relYawDeg: relYaw }; } } catch {}
    // POLISH-ANIM-INSPECT-01 (cycle1003): 検分中はピッチへ見下ろしオフセットを重畳する (消費点はここ1箇所)
    if (rot && isInspectActive(r.inspectAnimAt, Date.now())) rot = { ...rot, x: applyInspectPitch(rot.x, Date.now() - r.inspectAnimAt) };
    if (rot && isNodActive(r.nodAnimAt, Date.now())) rot = { ...rot, x: applyNodPitch(rot.x, Date.now() - r.nodAnimAt) };
    if (rot && isRecallcheckActive(r.recallcheckAnimAt, Date.now())) rot = { ...rot, x: applyRecallcheckPitch(rot.x, Date.now() - r.recallcheckAnimAt) }; // POLISH-ANIM-RECALLCHECK-01 (cycle1238): 再召喚で荷物が戻った直後の手元確認 (表示層のみ・実機確認待ち)
    // POLISH-ANIM-SETTLE-01 feeder (cycle2058): lastAction の BREAK 成功 (seq変化) の辺でのみ発火記録 (表示層のみ・実機確認待ち)
    try { const la = r.lastAction; if (la && la.act === "BREAK" && la.ok && la.seq !== r.settleSeenSeq) { r.settleSeenSeq = la.seq; if (shouldSettle({ broke: true, suppressed: ((ctx?.danger?.count ?? 0) > 0) || r.selfFalling === true || !!bot.isInWater, lastFiredMs: r.settleLastAt ?? null, nowMs: Date.now() })) { r.settleAnimAt = la.at || Date.now(); r.settleLastAt = r.settleAnimAt; r.lastSettle = { at: r.settleAnimAt, item: la.item || null }; } } } catch {}
    if (rot && isSettleActive(r.settleAnimAt, Date.now())) rot = { ...rot, x: applySettlePitch(rot.x, Date.now() - r.settleAnimAt) }; // POLISH-ANIM-SETTLE-01 (cycle2058): 重畳 (表示層のみ・実機確認待ち)
    // POLISH-ANIM-PLACESETTLE-01 feeder (cycle2248): lastAction の PLACE 成功 (seq変化) の辺でのみ発火記録 (表示層のみ・実機確認待ち)
    try { const la = r.lastAction; if (la && la.act === "PLACE" && la.ok && la.seq !== r.placesettleSeenSeq) { r.placesettleSeenSeq = la.seq; if (shouldPlacesettle({ placed: true, suppressed: ((ctx?.danger?.count ?? 0) > 0) || r.selfFalling === true || !!bot.isInWater, lastFiredMs: r.placesettleLastAt ?? null, nowMs: Date.now() })) { r.placesettleAnimAt = la.at || Date.now(); r.placesettleLastAt = r.placesettleAnimAt; r.lastPlacesettle = { at: r.placesettleAnimAt, item: la.item || null }; } } } catch {}
    if (rot && isPlacesettleActive(r.placesettleAnimAt, Date.now())) rot = { ...rot, x: applyPlacesettlePitch(rot.x, Date.now() - r.placesettleAnimAt) }; // POLISH-ANIM-PLACESETTLE-01 (cycle2248): 重畳 (表示層のみ・実機確認待ち)
    // POLISH-ANIM-YIELD-01 feeder (cycle0153): 主人との対向接近を既存観測だけで組み立てる (新規走査は側方2セル×2段のみ)。lateralOffset は実座標へ流さず記録のみ、ヨー/ピッチだけ重畳 (表示層のみ・実機確認待ち)
    try { if (!r.combatendState) r.combatendState = createCombatEndState(); const nowC = Date.now(); const hurtNowC = !!(r.lastSelfHurtAt && r.lastSelfHurtAt !== r.combatendHurtSeen); if (hurtNowC) r.combatendHurtSeen = r.lastSelfHurtAt; let surfC = false; try { surfC = !!(r.surfacebreathState && sampleSurfacebreath(r.surfacebreathState, nowC).active); } catch {} const evC = noteCombatEnd(r.combatendState, { hostileCount: scan ? (scan.hostiles || []).length : undefined, hurtNow: hurtNowC, working: !!r.work, falling: r.selfFalling === true, inWaterSurfaced: surfC }, nowC); if (evC && evC.reason !== "not_confirmed" && evC.reason !== "still_in_combat") r.lastCombatEnd = { at: nowC, fired: !!evC.fired, reason: evC.reason }; } catch {} // POLISH-ANIM-COMBATEND-01 (cycle0224): feeder は既存走査 scan.hostiles のみ (新規走査なし、発火を戦闘判定へ逆流させない)
    try { if (!r.yieldState) r.yieldState = createYieldState(); const nowY = Date.now(); const dxY = owner.location.x - bot.location.x, dzY = owner.location.z - bot.location.z; const dHY = Math.hypot(dxY, dzY); const approachingY = Number.isFinite(r.yieldLastDist) ? dHY < r.yieldLastDist - 0.005 : false; r.yieldLastDist = dHY; let facingY = 0; try { const oy = owner.getRotation?.().y; const by = rot?.y; if (Number.isFinite(oy) && Number.isFinite(by)) facingY = Math.abs(((oy - by + 540) % 360) - 180); } catch {} let roomYL = false, roomYR = false; try { if (dHY > 0.01) { const ux = dxY / dHY, uz = dzY / dHY; const roomAt = (sx, sz) => { const fx = Math.floor(bot.location.x + sx), fy = Math.floor(bot.location.y), fz = Math.floor(bot.location.z + sz); const free = (b) => !b || (!solidOfTypeId(b.typeId) && !b.isLiquid); return free(bot.dimension.getBlock({ x: fx, y: fy, z: fz })) && free(bot.dimension.getBlock({ x: fx, y: fy + 1, z: fz })); }; roomYL = roomAt(-uz, ux); roomYR = roomAt(uz, -ux); } } catch {} const yEv = noteYield(r.yieldState, { ownerDist: dHY, facingDiffDeg: facingY, approaching: approachingY, roomLeft: roomYL, roomRight: roomYR, working: !!r.work, danger: ((ctx?.danger?.count ?? 0) > 0), falling: r.selfFalling === true, inWater: !!bot.isInWater }, nowY); if (yEv?.fired) r.lastYield = { at: nowY, side: yEv.side, reason: yEv.reason }; } catch {}
    // POLISH-ANIM-CRAFTSETTLE-01 feeder (cycle0141): lastAction の CRAFT/SMELT 成功 (seq変化) の辺でのみ発火記録 (表示層のみ・実機確認待ち)
    try { const la = r.lastAction; if (la && (la.act === "CRAFT" || la.act === "SMELT") && la.ok && la.seq !== r.craftsettleSeenSeq) { r.craftsettleSeenSeq = la.seq; if (shouldCraftsettle({ crafted: true, suppressed: ((ctx?.danger?.count ?? 0) > 0) || r.selfFalling === true || !!bot.isInWater, lastFiredMs: r.craftsettleLastAt ?? null, nowMs: Date.now() })) { r.craftsettleAnimAt = la.at || Date.now(); r.craftsettleLastAt = r.craftsettleAnimAt; r.lastCraftsettle = { at: r.craftsettleAnimAt, item: la.item || null, act: la.act }; } } } catch {}
    if (rot && isCraftsettleActive(r.craftsettleAnimAt, Date.now())) rot = { ...rot, x: applyCraftsettlePitch(rot.x, Date.now() - r.craftsettleAnimAt) }; // POLISH-ANIM-CRAFTSETTLE-01 (cycle0141): 重畳 (表示層のみ・実機確認待ち)
    if (rot && isDeliverBowActive(r.deliverBowAt, Date.now())) rot = { ...rot, x: applyDeliverBowPitch(rot.x, Date.now() - r.deliverBowAt) }; // POLISH-ANIM-DELIVERBOW-01 (cycle0446): 手渡し成功直後の会釈 (表示層のみ・実機確認待ち)
    // POLISH-ANIM-STORESETTLE-01 feeder (cycle0505): lastAction の STORE 成功 (seq変化) の辺でのみ発火記録 (表示層のみ・実機確認待ち)
    try { const la = r.lastAction; if (la && la.act === "STORE" && la.ok && la.seq !== r.storesettleSeenSeq) { r.storesettleSeenSeq = la.seq; if (shouldStoresettle({ stored: true, suppressed: ((ctx?.danger?.count ?? 0) > 0) || r.selfFalling === true || !!bot.isInWater, lastFiredMs: r.storesettleLastAt ?? null, nowMs: Date.now() })) { r.storesettleAnimAt = la.at || Date.now(); r.storesettleLastAt = r.storesettleAnimAt; r.lastStoresettle = { at: r.storesettleAnimAt, item: la.item || null }; } } } catch {}
    if (rot && isStoresettleActive(r.storesettleAnimAt, Date.now())) rot = { ...rot, x: applyStoresettlePitch(rot.x, Date.now() - r.storesettleAnimAt) }; // POLISH-ANIM-STORESETTLE-01 (cycle0505): 重畳 (表示層のみ・実機確認待ち)
    // POLISH-ANIM-NOSPACE-01 feeder (cycle0537): TAKE の INVENTORY_FULL (r.lastTake の at 変化) の辺でのみ発火 (表示層のみ・実機確認待ち)
    try { const lt = r.lastTake; if (lt && lt.act === "TAKE" && !lt.ok && lt.reason === "INVENTORY_FULL" && lt.at !== r.nospaceSeenAt) { r.nospaceSeenAt = lt.at; if (shouldNospace({ full: true, suppressed: ((ctx?.danger?.count ?? 0) > 0) || r.selfFalling === true || !!bot.isInWater, lastFiredMs: r.nospaceLastAt ?? null, nowMs: Date.now() })) { r.nospaceAnimAt = lt.at || Date.now(); r.nospaceLastAt = r.nospaceAnimAt; r.lastNospace = { at: r.nospaceAnimAt, item: lt.item || null }; } } } catch {}
    if (rot && isNospaceActive(r.nospaceAnimAt, Date.now())) rot = { ...rot, y: applyNospaceYaw(rot.y, Date.now() - r.nospaceAnimAt) }; // POLISH-ANIM-NOSPACE-01 (cycle0537): ヨー重畳は最下位 (表示層のみ・実機確認待ち)
    // POLISH-ANIM-LOWCEILDUCK-01 feeder+重畳 (cycle0553): 頭上セル (足元+2) の固体観測は200ms間引きの1セルだけ (新規走査はこの1セルのみ)。沈みは r.lastLowCeilDuck 記録のみ (表示層のみ・実機確認待ち)
    try { if (!r.lowceilduckState) r.lowceilduckState = createLowCeilDuckState(); if (Date.now() - (r.lowceilCheckAt || 0) >= 200) { r.lowceilCheckAt = Date.now(); let low = null; try { const cb = bot.dimension.getBlock({ x: Math.floor(bot.location.x), y: Math.floor(bot.location.y) + 2, z: Math.floor(bot.location.z) }); low = cb ? solidOfTypeId(cb.typeId) : null; } catch { low = null; } r.lowceilduckState = noteLowCeilDuck(r.lowceilduckState, { lowCeil: low, suppressed: ((ctx?.danger?.count ?? 0) > 0) || r.selfFalling === true || !!bot.isInWater, nowMs: Date.now() }); } if (rot) { const lcd = sampleLowCeilDuck(r.lowceilduckState, Date.now()); if (lcd.active) { rot = { ...rot, x: rot.x + lcd.pitchDeg }; r.lastLowCeilDuck = { at: Date.now(), sink: lcd.sink, blend: lcd.blend }; } } } catch {}
    // POLISH-ANIM-STOW-01 feeder (cycle0522): 作業セッション (BREAK/PLACE/CRAFT/SMELT成功の連なり) の終了の辺でのみ発火 (表示層のみ・実機確認待ち。腕は記録のみ)
    try { if (!r.stowState) r.stowState = createStowState(); const la = r.lastAction; if (la && la.ok && la.seq !== r.stowSeenSeq) { r.stowSeenSeq = la.seq; r.stowState = noteStowWork(r.stowState, { nowMs: la.at || Date.now(), kind: la.act, success: true }); } const supS = ((ctx?.danger?.count ?? 0) > 0) || r.selfFalling === true || !!bot.isInWater; const ovS = isSettleActive(r.settleAnimAt, Date.now()) || isPlacesettleActive(r.placesettleAnimAt, Date.now()) || isCraftsettleActive(r.craftsettleAnimAt, Date.now()) || isStoresettleActive(r.storesettleAnimAt, Date.now()); const tk = noteStowTick(r.stowState, { nowMs: Date.now(), workActive: !!(r.work || r.buildPlan || r.mission), suppressed: supS, overlayActive: ovS, toolTypeId: null }); r.stowState = tk.state; if (tk.fired) { r.stowAnimAt = Date.now(); r.lastStow = { atMs: r.stowAnimAt, toolTypeId: tk.toolTypeId, armPitchDeg: STOW_MAX_ARM_DEG }; } } catch {}
    if (rot && isStowActive(r.stowAnimAt, Date.now())) rot = { ...rot, x: applyStowPitch(rot.x, Date.now() - r.stowAnimAt) }; // POLISH-ANIM-STOW-01 (cycle0522): 重畳は最下位 (表示層のみ・実機確認待ち)
    if (rot && isLevelupNodActive(r.levelupnodAnimAt, Date.now()) && !isFlinchActive(r.flinchAnimAt, Date.now()) && !isNodActive(r.nodAnimAt, Date.now())) rot = { ...rot, x: applyLevelupNodPitch(rot.x, Date.now() - r.levelupnodAnimAt) }; // POLISH-ANIM-LEVELUPNOD-01 (cyc2122): 最下位重畳 (表示層のみ・実機確認待ち)
    if (rot && r.snowtreadState) { try { const so = snowtreadCurrentOffset(r.snowtreadState); if (so.active) rot = { ...rot, x: applySnowtreadPitch(rot.x, r.snowtreadState.phase) }; } catch {} } // POLISH-ANIM-SNOWTREAD-01 (cycle2333): 重畳 (表示層のみ・実機確認待ち)
    if (rot && isFlinchActive(r.flinchAnimAt, Date.now())) rot = { ...rot, x: applyFlinchPitch(rot.x, Date.now() - r.flinchAnimAt) }; // POLISH-ANIM-FLINCH-01 (cycle1051)
    // POLISH-ANIM-ENDERAVERT-01 (cycle1940): feeder は既存走査 scan.hostiles から最寄りエンダーマンを取る (新規走査なし)。重畳は FLINCH の直下 (表示層のみ・実機確認待ち)
    if (rot) { try { if (!r.enderavertState) r.enderavertState = createEnderavertState(); const em = (scan?.hostiles || []).filter((x) => x.typeId === "minecraft:enderman").sort((a, b) => dist(bot.location, a.location) - dist(bot.location, b.location))[0] || null; const base = { falling: r.selfFalling === true, inWater: !!bot.isInWater, inCombat: gz.gaze === "danger" || gz.gaze === "danger_then_owner", otherOverlayActive: isFlinchActive(r.flinchAnimAt, Date.now()) }; let smp = { hasTarget: false, ...base }; if (em) { const gr = gazeRotation(bot.location, { x: em.location.x, y: em.location.y + 1.4, z: em.location.z }); let ry = ((gr.y - rot.y + 540) % 360) - 180; smp = { hasTarget: true, dist: dist(bot.location, em.location), relYawDeg: ry, ...base }; } const ev = noteEnderavert(r.enderavertState, smp, Date.now()); if (ev && (ev.entered || ev.exited)) r.lastEnderAvert = { at: Date.now(), entered: !!ev.entered, exited: !!ev.exited, reason: ev.reason || null }; const ea = sampleEnderavert(r.enderavertState, Date.now()); if (ea.active) rot = { ...rot, y: rot.y + ea.gazeYawOffsetDeg, x: rot.x + ea.gazePitchDeg }; } catch {} }
    if (rot && isSkyglanceActive(r.skyglanceAt, Date.now())) rot = { ...rot, x: applySkyglancePitch(rot.x, Date.now() - r.skyglanceAt) }; // POLISH-ANIM-SKYGLANCE-01 (cycle1133): 最下位優先で重畳
    if (rot && isTossActive(r.tossAnimAt, Date.now())) rot = { ...rot, x: applyTossPitch(rot.x, Date.now() - r.tossAnimAt) }; // POLISH-ANIM-TOSS-01 (cycle1400): 視線連動のみ live、腕ピッチは r.lastToss 記録 (RP配線は実機確認待ち)
    if (rot && isSummonScanActive(r.summonScanAt, Date.now())) rot = { ...rot, y: applySummonScanYaw(rot.y, Date.now() - r.summonScanAt) }; // POLISH-ANIM-SUMMONSCAN-01 (cycle1110): ヨー重畳は末尾1箇所のみ
    if (rot && isLookbackActive(r.lookbackAnimAt, Date.now())) { const oyaw = Math.atan2(-(owner.location.x - bot.location.x), owner.location.z - bot.location.z) * 180 / Math.PI; rot = { ...rot, y: applyLookbackYaw(rot.y, oyaw, Date.now() - r.lookbackAnimAt) }; } // POLISH-ANIM-LOOKBACK-01 (cycle1153): ヨー重畳の末尾 (表示層のみ)
    if (rot && isDryoffActive(r.dryoffAt, Date.now())) rot = { ...rot, y: applyDryoffYaw(rot.y, Date.now() - r.dryoffAt) }; // POLISH-ANIM-DRYOFF-01 (cycle1322): ヨー重畳の最下位 (表示層のみ)
    if (rot && r.heedState) { const hs = sampleHeed(r.heedState, Date.now()); if (hs.active) rot = { ...rot, y: rot.y + hs.gazeYawOffsetDeg, x: rot.x + hs.gazePitchDeg }; } // POLISH-ANIM-HEED-01 (cycle1443): 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.thresholdState) { const ts = sampleThreshold(r.thresholdState, Date.now()); if (ts.active) rot = { ...rot, x: rot.x + ts.gazePitchDeg }; } // POLISH-ANIM-THRESHOLD-01 (cycle1503): ピッチ重畳 (表示層のみ・実機確認待ち)
    if (rot && r.edgepeekState) { const es = sampleEdgepeek(r.edgepeekState, Date.now()); if (es.active) rot = { ...rot, x: rot.x + es.gazePitchDeg }; } // POLISH-ANIM-EDGEPEEK-01 (cycle1518): ピッチ重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.icebalanceState) { const isb = sampleIcebalance(r.icebalanceState, Date.now()); if (isb.active) rot = { ...rot, x: rot.x + isb.gazePitchDeg }; }
    if (rot && r.stepupState) { const sub = sampleStepup(r.stepupState, Date.now()); if (sub.active) rot = { ...rot, x: rot.x + sub.gazePitchDeg }; } if (rot && r.portalsteadyState && isPortalsteadyActive(r.portalsteadyState, Date.now())) { const po = portalsteadyOffsetsAt(r.portalsteadyState.startedAtMs, Date.now()); rot = { ...rot, x: rot.x + po.gazePitchDeg, y: rot.y + po.yawSwayDeg }; } if (rot && r.surfacebreathState) { const sb = sampleSurfacebreath(r.surfacebreathState, Date.now()); if (sb.active) rot = { ...rot, x: applySurfacebreathPitch(rot.x, Date.now() - r.surfacebreathState.startedAtMs) }; } if (rot && r.workglanceState) { const wg = sampleWorkglance(r.workglanceState, Date.now()); if (wg.active) rot = { ...rot, y: rot.y + wg.gazeYawOffsetDeg, x: rot.x + wg.gazePitchDeg }; } // WORKGLANCE-01 (cycle1728): lowest-priority overlay (display only) // SURFACEBREATH overlay (clamped) // POLISH-ANIM-PORTALSTEADY-01 (cycle1640): 重畳の最下位 (表示層のみ・実機確認待ち) // POLISH-ANIM-STEPUP-01 (cycle1603): ピッチ重畳の最下位 (icebalance の後ろ。表示層のみ・実機確認待ち) // POLISH-ANIM-ICEBALANCE-01 (cycle1543): ピッチ重畳の最下位 (edgepeek の後ろ。表示層のみ・実機確認待ち)
    if (rot && r.toolcheckSample?.active) rot = { ...rot, x: rot.x + r.toolcheckSample.gazePitchDeg, y: rot.y + r.toolcheckSample.gazeYawDeg }; // POLISH-ANIM-TOOLCHECK-01 (cycle1807): 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.warmhandsState) { try { const wh = sampleWarmhands(r.warmhandsState, Date.now()); if (wh.active) { rot = { ...rot, x: rot.x + wh.pitchDeg }; r.lastWarmhands = { at: Date.now(), pitchDeg: wh.pitchDeg, armPitchDeg: wh.armPitchDeg }; } } catch {} } // POLISH-ANIM-WARMHANDS-01 (cycle0740): 重畳の最下位 (表示層のみ・実機確認待ち。腕は記録のみ)
    if (rot && r.loadpostureState) { const lp = sampleLoadPosture(r.loadpostureState, Date.now()); if (lp.active) rot = { ...rot, x: rot.x + lp.pitchDeg }; } // POLISH-ANIM-LOADPOSTURE-01 (cycle1832): ピッチ重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.partnercheckState) { const pc = partnerCheckOffset(r.partnercheckState, Date.now()); if (pc.active) rot = { ...rot, y: rot.y + pc.yawDeg, x: rot.x + pc.pitchDeg }; } if (rot && r.ownerreturnState) { const orc = ownerReturnOffset(r.ownerreturnState, Date.now()); if (orc.active) rot = { ...rot, y: rot.y + orc.yawDeg, x: rot.x + orc.pitchDeg }; } // POLISH-ANIM-OWNERRETURN-01 (cycle1923): 重畳の最下位 (表示層のみ・実機確認待ち) // POLISH-ANIM-PARTNERCHECK-01 (cycle1850): 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.musicnodState) { const mn = sampleMusicnod(r.musicnodState, Date.now()); if (mn.active) rot = { ...rot, x: rot.x + mn.gazePitchDeg }; } // POLISH-ANIM-MUSICNOD-01 (cycle2006): 重畳の最下位 (表示層のみ・実機確認待ち、近傍滞在が代理条件)
    if (rot && r.stairlookState) { const sp = stairLookPitch(r.stairlookState, Date.now()); if (sp) rot = { ...rot, x: rot.x + sp }; } // POLISH-ANIM-STAIRSLOOK-01 (cycle1514): 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.orderlookState) { const ol = sampleOrderLook(r.orderlookState, Date.now()); if (ol.active) rot = { ...rot, x: rot.x + ol.pitchDeg }; } // POLISH-ANIM-ORDERLOOK-01: 重畳の最下位 (表示層のみ・実機確認待ち)。0-E1 の 2tick 視線で 850ms の頷きが複数回サンプリングされる
    if (rot && r.homebowState) { const hb2 = sampleHomebow(r.homebowState, Date.now()); if (hb2.active) rot = { ...rot, x: rot.x + hb2.pitchDeg }; } // POLISH-ANIM-HOMEBOW-01 (cyc1908): 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.idleState) { const idl = sampleIdle(r.idleState, Date.now()); if (idl.active) rot = { ...rot, y: rot.y + idl.gazeYawRelDeg, x: rot.x + idl.gazePitchDeg }; } // POLISH-ANIM-IDLE-01 (cycle2020): 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.lookleadSample && (r.lookleadSample.active || r.lookleadSample.completed) && Date.now() - (r.lookleadSampleAt || 0) < 200) rot = { ...rot, y: rot.y + r.lookleadSample.yawDeltaDeg, x: rot.x + r.lookleadSample.pitchDeltaDeg }; // POLISH-ANIM-LOOKLEAD-01 (cycle2036): 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.catchsightState) { const cs = sampleCatchsight(r.catchsightState, Date.now(), catchsightSuppressInput(bot, owner, ctx, gz, r, Date.now())); if (cs.active) rot = { ...rot, y: rot.y + cs.yawDeg, x: rot.x + cs.pitchDeg }; } // POLISH-ANIM-CATCHSIGHT-01 (cycle2200): 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.rainshelterState) { const rs = sampleRainShelter(r.rainshelterState, Date.now()); if (rs.active) rot = { ...rot, y: rot.y + rs.gazeYawOffsetDeg, x: rot.x + rs.gazePitchDeg }; } // POLISH-ANIM-RAINSHELTER-01 (cycle2231): 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.wakestretchState) { try { const wk = wakestretchCurrent(r.wakestretchState, Date.now()); if (wk.active) rot = { ...rot, y: rot.y + wk.yawDeg, x: applyWakestretchPitch(rot.x, Date.now() - (r.wakestretchState.startedAtMs || Date.now())) }; } catch {} }
    if (rot && r.ownerfalltrackState) { try { const oft = ownerfalltrackCurrent(r.ownerfalltrackState, r.ownerfalltrackSample || {}, Date.now()); if (oft.active || oft.pitchDeg || oft.yawOffsetDeg) rot = { ...rot, y: rot.y + (oft.yawOffsetDeg || 0), x: rot.x + (oft.pitchDeg || 0) }; } catch {} } // POLISH-ANIM-OWNERFALLTRACK-01 (cycle0033): lowest overlay (display only) // POLISH-ANIM-WAKESTRETCH-01 (cycle0005): 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.falllandState) { try { const fl = falllandCurrent(r.falllandState, Date.now()); if (fl.active) { rot = { ...rot, x: rot.x + fl.pitchDeg }; if (fl.mode === "land") r.lastFallLand = { ...(r.lastFallLand || {}), at: Date.now(), mode: "land", landTier: fl.landTier, sink: fl.sink }; } } catch {} } // POLISH-ANIM-FALLLAND-01 (cycle0057): 重畳の最下位 (表示層のみ・実機確認待ち。sink は RP 受け口が無い間は記録のみ)
    if (rot && r.falllandState) { try { const fl2 = falllandCurrent(r.falllandState, Date.now()); if (fl2.active && fl2.mode === "land") { if (!r.land02State) r.land02State = createLandEnvState(); let cat02 = null; try { const gb2 = bot.dimension.getBlock({ x: Math.floor(bot.location.x), y: Math.floor(bot.location.y) - 1, z: Math.floor(bot.location.z) }); if (gb2) cat02 = materialOfTypeId(gb2.typeId); } catch {} const adj02 = noteLandEnv(r.land02State, { tier: fl2.landTier, category: cat02, nowMs: Date.now() }); if (adj02) r.lastLand02 = { at: Date.now(), tier: adj02.tier, cls: adj02.cls, known: adj02.known, sink: adj02.sink, pitchDeg: adj02.pitchDeg, durationMs: adj02.durationMs }; } } catch {} } // POLISH-ANIM-LAND-02 (cycle0252): 着地の環境差は記録のみ (表示への適用は FALLLAND との二重適用を避けるため次段・実機確認待ち)
    if (rot && r.routecheckState) { try { const rc2 = sampleRoutecheck(r.routecheckState, Date.now()); if (rc2.active) rot = { ...rot, x: rot.x + rc2.gazePitchDeg }; } catch {} } // POLISH-ANIM-ROUTECHECK-01 (cycle0117): 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.yieldState) { try { const ys = sampleYield(r.yieldState, Date.now()); if (ys.active) rot = { ...rot, y: rot.y + ys.yawDeg, x: rot.x + ys.gazePitchDeg }; } catch {} } // POLISH-ANIM-YIELD-01 (cycle0153): 重畳の最下位 (表示層のみ・実機確認待ち。lateralOffset は実座標へ流さない)
    if (rot && r.combatendState) { try { const ce = sampleCombatEnd(r.combatendState, Date.now()); if (ce.active) { rot = { ...rot, x: rot.x + ce.pitchDeg }; r.lastCombatEnd = { ...(r.lastCombatEnd || {}), armPitchDeg: ce.armPitchDeg }; } } catch {} } // POLISH-ANIM-COMBATEND-01 (cycle0224): 重畳の最下位 (表示層のみ・実機確認待ち。腕ピッチは記録のみ)
    if (rot && r.horizonState) { try { const ho = horizonCurrentOffset(r.horizonState, Date.now(), rot.y, null); if (ho.active) rot = { ...rot, x: rot.x + ho.pitchDeg }; } catch {} } // POLISH-ANIM-HORIZONGLANCE-01 (cycle0320): pitch-only stage1 (sun yaw unverified), lowest overlay (display only, real-machine check pending)
    if (rot && r.fullmoonState) { try { const fm = fullMoonCurrentOffset(r.fullmoonState, Date.now()); if (fm.active) rot = { ...rot, x: Math.min(75, Math.max(-60, rot.x + fm.pitchDeg)) }; } catch {} } // POLISH-ANIM-FULLMOONGAZE-01 (v0.5.80): 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.doubletakeState) { try { const dt2 = sampleDoubletake(r.doubletakeState, Date.now()); if (dt2.active) rot = { ...rot, y: rot.y + dt2.yawDeg, x: rot.x + dt2.pitchDeg }; } catch {} } // POLISH-ANIM-DOUBLETAKE-01 (cycle0403): 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.darkentryState && darkEntryActive(r.darkentryState, Date.now())) { try { const deo = darkEntryOffset(Date.now() - r.darkentryState.activeFromMs); if (deo) rot = { ...rot, y: rot.y + deo.yawDeg, x: Math.min(75, Math.max(-60, rot.x + deo.pitchDeg)) }; } catch {} } // POLISH-ANIM-DARKENTRY-01 (cycle0423): 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.nightwatchState) { try { const nw = sampleNightwatch(r.nightwatchState, Date.now()); if (nw.active) rot = { ...rot, y: rot.y + nw.yawDeg, x: applyNightwatchPitch(rot.x, Date.now() - (r.nightwatchState.startedAtMs || Date.now())) }; } catch {} } // POLISH-ANIM-NIGHTWATCH-01 (cycle0340): 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.xpglanceState) { try { const xs = sampleXpGlance(r.xpglanceState, Date.now()); if (xs.active) { const bl = blendXpGlanceGaze({ yawDeg: rot.y, pitchDeg: rot.x }, xs); if (bl) rot = { ...rot, y: bl.yawDeg, x: bl.pitchDeg }; } } catch {} } // POLISH-ANIM-XPGLANCE-01 (cycle0628): 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.villagergreetState) { try { const vg = sampleVillagergreet(r.villagergreetState, Date.now()); if (vg.active) rot = { ...rot, y: rot.y + vg.yawDeg, x: rot.x + vg.pitchDeg }; } catch {} } // POLISH-ANIM-VILLAGERGREET-01 (cycle0855): 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.orespotState) { try { const os2 = sampleOreSpot(r.orespotState, Date.now()); if (os2.active) rot = { ...rot, y: rot.y + os2.yawDeg, x: rot.x + os2.pitchDeg }; } catch {} } // POLISH-ANIM-ORESPOT-01 (cycle0832): 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.homesightState) { try { const hs2 = sampleHomesight(r.homesightState, Date.now()); if (hs2.active) rot = { ...rot, x: rot.x + hs2.pitchDeg }; } catch {} } // POLISH-ANIM-HOMESIGHT-01 (cycle0900): 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.sleepwatchState) { try { const sw2 = sampleSleepwatch(r.sleepwatchState, Date.now()); if (sw2.active) { let yawPull = 0; try { if (owner) { const gr = gazeRotation(bot.location, { x: owner.location.x, y: owner.location.y + 1.4, z: owner.location.z }); yawPull = sleepwatchYawPullDeg(rot.y, gr?.y); } } catch {} rot = { ...rot, y: rot.y + yawPull, x: rot.x + sw2.pitchDeg }; } } catch {} } // POLISH-ANIM-SLEEPWATCH-01 (cycle0910): 重畳の最下位 (表示層のみ・実機確認待ち。体は回さない)
    if (rot && r.mountglanceState) { try { const mg2 = sampleMountglance(r.mountglanceState, Date.now()); if (mg2.active) { let yawPull = 0; try { if (owner) { const gr = gazeRotation(bot.location, { x: owner.location.x, y: owner.location.y + 1.4, z: owner.location.z }); yawPull = mountglanceYawPullDeg(rot.y, gr?.y); } } catch {} rot = { ...rot, y: rot.y + yawPull, x: rot.x + mg2.pitchDeg }; } } catch {} } // POLISH-ANIM-MOUNTGLANCE-01 (cycle0936): 重畳の最下位 (表示層のみ・実機確認待ち。体は回さない)
    if (rot && r.wakegreetState) { try { const wg2 = sampleWakegreet(r.wakegreetState, Date.now()); if (wg2.active) { let yawPull = 0; try { if (owner) { const gr = gazeRotation(bot.location, { x: owner.location.x, y: owner.location.y + 1.4, z: owner.location.z }); yawPull = wakegreetYawPullDeg(rot.y, gr?.y); } } catch {} rot = { ...rot, y: rot.y + yawPull, x: rot.x + wg2.pitchDeg }; } } catch {} } // POLISH-ANIM-WAKEGREET-01 (cyc1939): 重畳の最下位 (表示層のみ・実機確認待ち。体は回さない)
    if (rot && r.shiverState) { try { const nowS = Date.now(); if (isShiverActive(r.shiverState.startedAtMs, nowS)) rot = { ...rot, y: applyShiverYaw(rot.y, nowS - r.shiverState.startedAtMs) }; } catch {} } // POLISH-ANIM-SHIVER-01 (cyc2355): ヨー重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot && r.lastEatGlance) { try { rot = { ...rot, x: applyEatGlancePitch(rot.x, Date.now() - r.lastEatGlance.at, r.lastEatGlance.kind) }; } catch {} } // POLISH-ANIM-EATGLANCE-01: 重畳の最下位 (表示層のみ・実機確認待ち)
    if (rot) { try { bot.setRotation(rot); } catch {} }
  }
  if (gz.say && !r.gazeReplayCall && Math.random() < 0.4) sayAmbient(owner, bot, gz.say); // 0-E1: 視線再適用 (2tick) では環境発話を繰り返さない
}

// 名札の状態表示: 「今何をしているか／何をしようとしているか」を頭上に1行で出す（TANAKA指示）
const GOAL_TAG = {
  rest_recover: "休憩中", guard_owner: "警戒中", pickup_drops: "回収に向かっています",
  deposit_at_home: "入庫に向かっています", deliver_to_owner: "お届けに向かっています",
  return_home: "帰還中", place_torch_dark: "松明を置いています", farm_crops: "収穫に向かっています",
  mine_ore: "採掘に向かっています", gather_wood: "伐採に向かっています", gather_stone: "採石に向かっています",
  follow_owner: "追従中", explore_nearby: "周囲を確認中", idle_near_owner: "そばにいます",
};
function statusTagOf(bot, r, effAct) {
  if (r.longtask) {
    const lt = r.longtask;
    if (lt.phase === "deliver") return `${lt.name}をお届け中`;
    const leg = lt.legs[lt.legIdx];
    return `自律作業中：${lt.name}（${leg ? legLabel(leg, lname) : "仕上げ中"}）`;
  }
  if (r.mission) {
    const s = missionSummary(r.mission);
    if (s) {
      if (s.status === "suspended") return `指示を保留中：${nameOfItem(s.target)}`;
      const cs = s.currentStep;
      if (cs) {
        if (cs.type === "gather_block") return `${nameOfItem(cs.target || s.target)}を集めています ${cs.have}/${cs.need}`;
        if (cs.type === "hunt_entity") return `${nameOfItem(cs.target || s.target)}を狩っています ${cs.have}/${cs.need}`;
        if (cs.type === "side_collect") return `寄り道中：${nameOfItem(cs.target || s.target)} ${cs.have}/${cs.need}`;
        if (cs.type === "goto_area") return `${nameOfItem(s.target)}を探しに向かっています`;
        if (cs.type === "return") return "戻っています";
        if (cs.type === "deliver") return `${nameOfItem(s.target)}をお届け中`;
        if (cs.type === "report") return "報告の準備中";
      }
      return `指示対応中：${nameOfItem(s.target)}（${s.stepsDone}/${s.stepsTotal}段階）`;
    }
  }
  if (r.buildPlan) return r.buildPlan.stage === "gather" ? `建築の材料集め中：${r.buildPlan.name}` : `建築中：${r.buildPlan.name}（${r.buildPlan.placed || 0}箇所）`;
  if (r.work) {
    const t = r.work.typeId || "";
    return CROP_DROPS[t] ? "収穫中" : (t.includes("_log") || t.includes("_wood") || (t.endsWith("_stem") && /(crimson|warped)/.test(t))) ? "伐採中" : "採掘中";
  }
  const actLabel = effAct ? (ACT_LABEL[effAct] || "") : "";
  const passive = !actLabel || effAct === "follow" || effAct === "follow_close" || effAct === "follow_high" || effAct === "idle_hover" || effAct === "stay_anchor";
  if (passive && r.goal && GOAL_TAG[r.goal]) return GOAL_TAG[r.goal]; // 受動時はプランナーの狙い（考えていること）を見せる
  if (actLabel) return actLabel;
  if (r.goal && GOAL_TAG[r.goal]) return GOAL_TAG[r.goal];
  return "";
}
function setTag(bot, r, text) {
  const tag = text ? `リゼ §7${text}` : "リゼ";
  if (r.lastTag === tag) return;
  r.lastTag = tag;
  try { bot.nameTag = tag; } catch {}
}

// 脳（ループは10tick間隔、偶奇で半分ずつ処理するため各Botの思考は実効20tick=1秒ごと。v0.4.56 コメント是正）
system.runInterval(() => {
  let idx = 0;
  for (const p of world.getAllPlayers()) {
    if (bodies.isBody(p)) continue; // v0.4.70: リゼの体 (模擬プレイヤー) は持ち主ではない
    const bot = findBotEntity(p.id); if (!bot) continue;
    if ((tick + idx++ * 3) % 2 !== 0) continue;
    const r = rt(bot);
    const { ctx, scan } = buildContext(bot, p);
    r.lastCtx = ctx;
    try { tickEndgoalShadow(bot, r, ctx); } catch {} // ENDGOAL W-A C1 (cyc2363): shadow 駆動 (オンライン経路)
    const { move, speech } = decide(ctx);
    if (speech) {
      const cat = ACT_LINE_CATEGORY[speech.act];
      const isEvent = (speech.p >= 600 && speech.act !== "celebrate") || speech.act === "use_heal_item";
      if (speech.say) { if (isEvent) say(p, bot, speech.say); else sayAmbient(p, bot, speech.say); }
      else if (cat) { if (isEvent) sayFromCategory(p, bot, cat); else sayFromCategoryAmbient(p, bot, cat); }
    }
    const mode = dp(bot, "cb_mode", "follow");
    // 仲裁（挙動ベンチのドライバと同一仕様）:
    // ミッション中は directive が基本行動。安全割り込みは生命危機系（flee/rest_at_home・p>=900）のみ。
    // hostiles='ignore' の間は guard/zap/flee を selfHp>=0.25 の範囲で抑止する。
    let consumed = false;
    // RR-05 (cycle1303): 通常ミッション (longtask 無し) の cannot_recover suspended にも再開の担い手を持たせる
    if (!r.longtask && r.mission && r.mission.status === "suspended" && (r.mission.suspendReason === "cannot_recover" || r.mission.suspendReason === "inv_unreadable")) {
      const sres = tickSuspendedResume(bot, r);
      if (sres === "waiting") consumed = true;
      else if (sres === "expired") { foldGatherBuildPlan(bot, p, r, "suspend_expired", r.mission); say(p, bot, `体力が回復しなかったため、指示を中断しました`, true); r.mission = null; clearPlanRecords(r); clearPendingTool(bot, r); clearPendingGearSet(bot, r); persistMission(bot, r, true); consumed = true; }
    }
    // cycle0606 PLAIN-SUSPEND-NOEXIT: 単発 suspended 6理由の期限型出口 (別担い手 tickPlainSuspendExpiry、10分で終了掃除)
    if (!consumed && !r.longtask && r.mission && r.mission.status === "suspended") {
      const pres = tickPlainSuspendExpiry(bot, r);
      // waiting は消費しない (保留中も通常行動を妨げない。従来の suspended 単発の振る舞いを維持)
      if (pres === "expired") { const rsn = r.mission.suspendReason; say(p, bot, `保留が長引いたため、指示を中断しました。${SUSPEND_JP[rsn] || "進めなくなりました"}`, true); noteFail(bot, "mission:plain_suspend_expired", new Error(rsn || "")); r.mission = null; clearPlanRecords(r); clearPendingTool(bot, r); clearPendingGearSet(bot, r); persistMission(bot, r, true); consumed = true; }
    }
    // キュー0副次 R1 (cycle1421): 単発ミッションの toolNeed は昇格接続が消費の入口になる (実装は tickLongTask 内の1か所のまま)
    if (!consumed && !r.longtask && r.toolNeed && tickToolPrepPromote(bot, p, r)) consumed = true;
    tickConditionWindow(bot, p, r, ctx); // R-C2-4 (cyc2380): window 終了監視は mission 稼働中にも評価する (保留側ガードの外)
    if (!consumed && tickPendingCondition(bot, p, r, ctx)) consumed = true; // 0-C2 読み手 (cycle1337): 条件成立で保留注文を開始する
    if (r.longtask && tickLongTask(bot, p, r, ctx)) consumed = true;
    if (!consumed && r.buildPlan && r.buildPlan.stage === "gather" && tickGatherNoProgress(bot, p, r)) consumed = true; // GATHER-NOEXIT: suspended でも評価されるよう active ゲートの外・前
    if (r.mission && r.mission.status === "active") {
      const hm = r.mission.order.constraints.hostiles;
      const suppressed = hm === "ignore" && move && ["guard", "zap", "flee"].includes(move.act) && ctx.self.hpPct >= 0.25;
      const interrupt = move && (move.p || 0) >= 900 && LIFE_CRITICAL_ACTS.has(move.act) && !suppressed;
      if (!interrupt) consumed = tickMission(bot, p, ctx, scan);
    }
    if (!consumed && r.buildPlan && r.buildPlan.stage === "build") consumed = tickBuild(bot, p, r, ctx);
    if (!consumed) {
      const effRaw = move || { act: mode === "stay" ? "stay_anchor" : "follow", id: "default" };
      const eff0 = mode === "stay" && effRaw.act === "idle_hover" ? { ...effRaw, act: "stay_anchor", id: "stay_anchor_override" } : effRaw; // stay時は気分アイドルよりアンカー維持を優先
      // ヒステリシス（非ミッション分岐のみ）: 前回行動を最低2サイクル保持し閾値振動を断つ。生命危機への切替は即時
      let eff = eff0;
      const h = r.hyst;
      const criticalSwitch = LIFE_CRITICAL_ACTS.has(eff0.act) && ctx.self.hpPct < 0.25;
      if (h && eff0.act !== h.act && h.held < 2 && !criticalSwitch && h.rule) { eff = h.rule; r.hyst = { act: h.act, held: h.held + 1, rule: h.rule }; }
      else r.hyst = { act: eff0.act, held: h && h.act === eff0.act ? h.held + 1 : 1, rule: eff0 };
      r.moveAct = eff.act;
      // Phase4 cb_trace act配線 (v0.4.65): 仲裁後の実効行動だけを記録する (分岐・実行は不変、読み手は表示専用)。
      // 器は act を畳まないため plan 前例の seen キーで同一エピソードを1件に抑え、成功時のみ前進させる
      try {
        const aev = mapInterruptAct({ act: eff.act, p: eff.p, goal: null, x: { hp: ctx.self?.hpPct ?? null, dg: ctx.danger?.count ?? null, scan: ctx.x?.obs?.scan ?? null, inv: ctx.x?.obs?.inv ?? null } });
        if (aev) { if (r.traceActSeen !== aev.a && r.trace?.record(aev)) r.traceActSeen = aev.a; }
        else if (!shouldRecordAct(eff.p)) r.traceActSeen = null;
      } catch {}
      r.ownerPosCache = { x: p.location.x, y: p.location.y, z: p.location.z };
      r.target = execTarget(bot, p, eff, ctx, scan);
      setTag(bot, r, statusTagOf(bot, r, eff.act));
      execArrive(bot, p, eff, ctx, scan);
      tickAutonomy(bot, p, ctx, eff);
    } else {
      r.hyst = null;
      try { r.traceActSeen = null; } catch {} // Phase4 act配線 (v0.4.65): 消費 tick は割込みエピソードの切れ目
      setTag(bot, r, statusTagOf(bot, r, null));
    }
    exitTunnelIfNeeded(bot, r);
    syncFlyGoal(bot, r);
    syncNavGoal(bot, r);
    applyGaze(bot, p, ctx, scan);
    try { r.gazeArgs = { owner: p, ctx, scan, at: Date.now() }; } catch {} // 0-E1: 視線レイヤー (2tick) が再適用するための最新引数の保持 (走査は増やさない)
    if (ctx.x?.firstToday && ctx.danger.count === 0) { r.greetedDay = world.getDay(); sayFromCategory(p, bot, world.getTimeOfDay() < 12000 ? "greet_morning" : "greet_night"); }
  }
}, 10);

// 0-E1 GAZE-CADENCE-01: 視線レイヤーを本体ループ (10tick) から分離し 2tick で回す。
// 本体が保持した最新の引数 (ctx/scan) を再適用するだけで、新規の走査は行わない
// (増えるのは setRotation の頻度だけ)。450〜600ms 級の波形が複数回サンプリングされ、
// ピーク角度が実際に適用される (test_gaze_cadence_0e1 で実測)。引数が古い間は休止する。
system.runInterval(() => {
  for (const p of world.getAllPlayers()) {
    if (bodies.isBody(p)) continue;
    const bot = findBotEntity(p.id); if (!bot) continue;
    const r = rt(bot);
    const ga = r.gazeArgs; if (!ga || !shouldReplayGaze(Date.now(), ga.at)) continue;
    r.gazeReplayCall = true;
    try { applyGaze(bot, ga.owner, ga.ctx, ga.scan); } catch {} finally { r.gazeReplayCall = false; }
  }
}, GAZE_REPLAY_INTERVAL_TICKS);

// オフラインの持ち主のBotはその場で待機
system.runInterval(() => {
  for (const d of DIMS) { try { for (const e of world.getDimension(d).getEntities({ type: BOT_ID })) { const oid = dp(e, "cb_owner", ""); if (oid && !getPlayer(oid)) { const r = rt(e); r.target = e.location; try { tickEndgoalShadow(e, r, null); } catch {} /* ENDGOAL W-A C2 (cyc2363): 無人経路 (M1 本体)。shadow は r.target を触らない */ } } } catch {} }
}, 40);

// 世界記憶の定期保存（30秒ごと・dirty のときだけ）
system.runInterval(() => {
  for (const [id, r] of bots) { try { if (r.wmem && r.wmem.dirty) r.wmem.save(); } catch {} try { if (r.trace && r.trace.dirty) r.trace.flush(); } catch {} try { const b = world.getEntity(id); if (b) flushFailAgg(b, r); } catch {} try { const b = world.getEntity(id); if (b) refreshWarehouseCandidates(b, r); } catch {} /* 倉庫W1 (cycle1514): 候補スキャン供給を周期 flush へ接続 (既知コンテナのみ・新規走査なし) */ try { const b = world.getEntity(id); if (b) saveWarehouse(b, r); } catch {} /* 倉庫W1 (cycle1434): 保存発火点を周期 flush へ接続 (従来は定義のみで呼び出し0件だった) */ try { const b = world.getEntity(id); if (b) flushExp(b, r); } catch {} /* 6-ML: 周期 flush 相乗り */ try { const b = world.getEntity(id); if (b) persistEndgoal(b, r); } catch {} /* ENDGOAL W-A (cyc2363): 周期 flush 相乗り */ }
}, 600);
world.afterEvents.entityHurt.subscribe((ev) => {
  try {
    const e = ev.hurtEntity;
    if (e.typeId === BOT_ID) {
      const wm = wmemOf(e); if (wm) wm.recordDanger(e.location, e.dimension.id, "damage", 1);
      // 防具軽減（script 方式）: 軽減分だけ体力を戻して実効ダメージを下げる
      const rr = rt(e); try { rr.lastSelfHurtAt = Date.now(); } catch {} // POLISH-ANIM-COMBATEND-01 (cycle0224): 自分の被弾時刻 (表示層の feeder 用)
      const core = equipCoreOf(e, rr);
      if (core && ev.damage > 0) {
        try {
          const m = core.mitigateDamage(ev.damage);
          if (m.blocked > 0) { const h = e.getComponent("minecraft:health"); if (h) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + m.blocked)); }
        } catch {}
      }
    }
    else if (e.typeId === "minecraft:player") { const b = findBotEntity(e.id); if (b) { const wm = wmemOf(b); if (wm) wm.recordDanger(e.location, e.dimension.id, "owner_hurt", 1); try { const br = rt(b); if (!br.partnercheckState) br.partnercheckState = createPartnerCheckState(); const bp = b.location, gr = gazeRotation(bp, { x: e.location.x, y: e.location.y + 1.4, z: e.location.z }); const cur = (() => { try { return b.getRotation(); } catch { return { x: 0, y: 0 }; } })(); let relYaw = gr.y - (cur?.y || 0); relYaw = ((relYaw + 540) % 360) - 180; const d3 = Math.hypot(e.location.x - bp.x, e.location.y - bp.y, e.location.z - bp.z); notePartnerCheck(br.partnercheckState, { ownerHurtEdge: true, isOwner: true, dist: d3, targetYawDeg: relYaw, targetPitchDeg: gr.x - (cur?.x || 0), working: !!br.work, falling: br.selfFalling === true, inWater: !!b.isInWater, ownerInFront: Math.abs(relYaw) < 12 && Math.abs(gr.x - (cur?.x || 0)) < 12 }, Date.now()); br.lastPartnerCheck = br.partnercheckState.lastRecord; } catch {} } }
  } catch {}
});

// ---------- イベント ----------
world.afterEvents.itemUse.subscribe((ev) => {
  if (ev.itemStack?.typeId !== REMOTE_ID) return;
  const p = ev.source;
  system.run(() => {
    const exist = findBotEntity(p.id, true); // 二重召喚の防止をキャッシュ鮮度に依存させないため必ず実走査
    if (exist) {
      let moved = false;
      try { const want = { x: p.location.x + 1, y: p.location.y, z: p.location.z + 1 }; moved = teleportNearOwnerGuarded(exist, rt(exist), p.dimension, want, p.location) === true; } catch {} // queue3 step2: place ゲート経由
      if (moved) noteSummonScan(rt(exist)); // POLISH-ANIM-SUMMONSCAN-01 (cycle1110): 再召喚が実際に移動したときだけ
      if (moved) { try { resetPlaceState(exist, rt(exist)); } catch {} say(p, exist, "ただいま。定位置は、あなたの隣です", true); } // v0.4.69: 呼ばれた場所から作業をやり直す (元の場所へ戻ろうとしない)
      else say(p, exist, "そちらへは、今は移れませんでした。作業は、今の場所で続けます", true); // cycle1400 a20 S-2: 移動失敗で作業状態を壊さない (resetPlaceState は成功時のみ)
      return;
    }
    const spawnDest = placeSpawnDest(p.dimension, p.location, { x: p.location.x + 1, y: p.location.y, z: p.location.z }); // queue3 step2: 生成前に place ゲートで行き先を決める
    if (!spawnDest) { try { p.sendMessage("§b<リゼ>§r 今は安全に立てる場所がありません。少し開けた場所で、もう一度お願いします"); } catch {} return; } // cycle0922 FC-13: 全候補 hold は spawn 見送り (bot 未生成のため say は使えない)
    const bot = p.dimension.spawnEntity(BOT_ID, spawnDest);
    noteSummonScan(rt(bot)); // POLISH-ANIM-SUMMONSCAN-01 (cycle1110): 新規スポーン成功直後のみ (生成分岐はここ1件)
    dps(bot, "cb_owner", p.id); dps(bot, "cb_mode", "follow"); dps(bot, "cb_bond", 30); dps(bot, "cb_trust", 30);
    botByOwner.set(p.id, { bot, at: Date.now() });
    try { dps(bot, "cb_firstday", world.getDay()); } catch {}
    try { bot.nameTag = "リゼ"; } catch {}
    // 回収されていた所持品を復元
    try {
      const saved = JSON.parse(wdp(`cb_savedinv:${p.id}`, "[]"));
      const cont = invOf(bot);
      if (cont && saved.length) { const norm = normalizeSavedInv(saved); for (const s of norm) { try { const st = new ItemStack(s.t, s.a); applyItemData(st, s); cont.addItem(st); } catch {} } wdps(`cb_savedinv:${p.id}`, "[]"); try { const rr = rt(bot); if (shouldRecallcheck({ restoredCount: norm.length, lastFiredMs: rr.recallcheckLastAt ?? null, nowMs: Date.now() })) { rr.recallcheckAnimAt = Date.now(); rr.recallcheckLastAt = rr.recallcheckAnimAt; } } catch {} }
    } catch {}
    // 装備の復元: 退避しておいた装備状態を新個体の cb_equip へ渡し、初回の equipCoreOf で restore() させる
    try {
      const se = wdp(`cb_saved_equip:${p.id}`, "");
      if (se) { dps(bot, "cb_equip", se); wdps(`cb_saved_equip:${p.id}`, ""); }
    } catch {}
    say(p, bot, "作業補助機、LIZE-07です。……リゼ、と呼んでください。そのほうが、返事をしやすいので", true);
  });
});

// v0.4.69: 場所に結びついた作業状態を捨てる。リモコンで呼ばれて瞬間移動した後に、元の場所の対象・探索の中心・
// トンネルの帰り道へ飛んで戻ろうとしていた (探索の中心は指示と一緒に保存されるので、最初に指示した場所へ引き戻されていた)
function resetPlaceState(bot, r) {
  r.mTargetLoc = null; r.mTargetKey = ""; r.mTargetEntity = null; r.mTargetSince = Date.now(); r.mBanKey = null;
  r.tunnel = null; r.d2Anchor = null; r.tunnelPath = []; r.tunnelExiting = false; r.tunnelExitHold = null; r.work = null; r.clearDig = null; r.exploreRegion = null;
  r.wander = null; r.stuckSec = 0; r.lastPos = null; r.watchHist = []; r.mScanMap = {}; r.percTargets = {};
  try { if (dp(bot, "cb_mode", "") === "stay") setAnchor(bot, r, { ...bot.location }, bot.dimension.id); else setAnchor(bot, r, null); } catch {} // BH-04/BH-06 (cycle1215): リモコンで呼ばれた先が stay の定位置になる (DP 同期)。stay 以外では旧定位置を残さない
  r.target = { x: bot.location.x, y: bot.location.y, z: bot.location.z };
  try { if (r.fly) flyClearGoal(r.fly); } catch {} try { if (r.nav) navClearGoal(r.nav); } catch {}
  const m = r.mission;
  if (m && Array.isArray(m.steps)) { for (const s of m.steps) { s.searchCenter = null; s.searchWp = 0; s.wpObs = 0; s.unknownObs = 0; s.searchStage = 0; s.searchObs = 0; s.seen = false; } persistMission(bot, r, true); }
  if (r.mineLeg) r.mineDir = null;
  // 調査結果も、新しい場所の周り (隣の区画まで) 以外は忘れる。残っていると、元の場所の木や鉱石を選び直して飛んで戻ってしまう
  try { const rg = regionOf(bot.location.x, bot.location.z); for (const [k, sv] of surveys) if (sv.dim === bot.dimension.id && (Math.abs(sv.rx - rg.rx) > 1 || Math.abs(sv.rz - rg.rz) > 1)) surveys.delete(k); } catch {}
}
function serializeInv(bot) {
  const cont = invOf(bot); const out = [];
  if (cont) for (let i = 0; i < cont.size; i++) { const it = cont.getItem(i); if (it) { const rec = extractItemData(it); if (rec) out.push(rec); } }
  return out;
}

// 右クリックの受け付け: バニラのコンテナUIが先に開くとフォームを出せなくなるため、
// beforeEvents で通常クリックをキャンセルしてメニューを開く。しゃがみ中はキャンセルせず、
// バニラのコンテナを直接開けるようにする（物の受け渡し用）。
const menuGuard = new Map();
try {
  world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
    if (ev.target?.typeId !== BOT_ID) return;
    const p = ev.player; const bot = ev.target;
    if (p.isSneaking) return; // しゃがみ＝コンテナを直接開く
    ev.cancel = true;
    menuGuard.set(p.id + ":" + bot.id, Date.now());
    if (dp(bot, "cb_owner", "") !== p.id) { system.run(() => say(p, bot, "……持ち主は、あなたではありません", true)); return; }
    system.run(() => openMenu(p, bot));
  });
} catch {}
world.afterEvents.playerInteractWithEntity.subscribe((ev) => {
  if (ev.target?.typeId !== BOT_ID) return;
  const p = ev.player; const bot = ev.target;
  if (Date.now() - (menuGuard.get(p.id + ":" + bot.id) || 0) < 1000) return; // before側で処理済み
  if (dp(bot, "cb_owner", "") !== p.id) { say(p, bot, "……持ち主は、あなたではありません", true); return; }
  system.run(() => openMenu(p, bot));
});

function openMenu(p, bot) {
  const mode = dp(bot, "cb_mode", "follow");
  const home = homeOf(bot); const st = stats(bot);
  const r0 = rt(bot);
  let misLine = "";
  if (r0.mission) { const s = missionSummary(r0.mission); if (s) misLine = `\n指示: ${nameOfItem(s.target)} ${s.currentStep ? `${s.currentStep.have}/${s.currentStep.need}` : ""}（${s.status}）`; }
  else if (r0.buildPlan) misLine = `\n建築: ${r0.buildPlan.name}（${r0.buildPlan.stage === "gather" ? "材料集め中" : "設置中"}）`;
  const form = new ActionFormData();
  form.title("リゼ (LIZE-07)");
  form.body(`モード: ${mode} / 回収累計: ${st.pickup || 0} / 拠点: ${home ? "登録済み" : "未登録"}${misLine}\n「次の作業まで、三分空いています」\n（しゃがみ＋右クリックで、中身を直接開けます）`);
  form.button("ついてくる", "textures/items/lize_remote");
  form.button("ここで待機", "textures/items/lize_remote");
  form.button("拠点で作業", "textures/items/lize_remote");
  form.button("おまかせ", "textures/items/lize_remote");
  form.button("ここを拠点に登録", "textures/items/lize_remote");
  form.button("中身を全部受け取る", "textures/items/lize_remote");
  form.button("状態を見る", "textures/items/lize_remote");
  form.button("回収する（中身は保持）", "textures/items/lize_remote");
  form.button("指示を出す", "textures/items/lize_remote");
  form.button("建築を頼む", "textures/items/lize_remote");
  form.button("指示の確認・中止", "textures/items/lize_remote");
  form.button("装備と荷物", "textures/items/lize_remote");
  form.button("文字で指示する", "textures/items/lize_remote");
  form.button("倉庫の登録・確認", "textures/items/lize_remote");
  form.show(p).then((res) => {
    if (res.canceled) return;
    const r = rt(bot);
    if (res.selection === 0) { dps(bot, "cb_mode", "follow"); say(p, bot, pick(ALL_LINES.start_follow || ["ついていきます"]), true); }
    if (res.selection === 1) { dps(bot, "cb_mode", "stay"); try { const bl = bot.location; setAnchor(bot, r, { x: bl.x, y: groundY(bot.dimension, bl.x, bl.z, bl.y, bl.y), z: bl.z }, bot.dimension.id); } catch { setAnchor(bot, r, { ...bot.location }, bot.dimension.id); } say(p, bot, pick(ALL_LINES.start_stay || ["ここで待っています"]), true); } // BH-04/BH-11: 定位置は DP へ保存し、y はホバー高度でなく地面へ寄せる
    if (res.selection === 2) { dps(bot, "cb_mode", "work"); say(p, bot, pick(ALL_LINES.start_work || ["働きます"]), true); }
    if (res.selection === 3) { dps(bot, "cb_mode", "free"); say(p, bot, "おまかせ、了解です。状況は私が見ます", true); }
    if (res.selection === 4) {
      let loc = null;
      try { const vb = p.getBlockFromViewDirection({ maxDistance: 10 }); if (vb && isContainerBlock(vb.block.typeId)) loc = vb.block.location; } catch {}
      if (!loc) { try { for (const e of []) {} } catch {} }
      if (!loc) { // 周囲4ブロックからコンテナ探索
        outer: for (let x = -4; x <= 4; x++) for (let y = -2; y <= 2; y++) for (let z = -4; z <= 4; z++) {
          try { const b = p.dimension.getBlock({ x: Math.floor(p.location.x) + x, y: Math.floor(p.location.y) + y, z: Math.floor(p.location.z) + z }); if (b && isContainerBlock(b.typeId)) { loc = b.location; break outer; } } catch {}
        }
      }
      if (loc) { dps(bot, "cb_home", JSON.stringify({ x: loc.x, y: loc.y, z: loc.z, dim: p.dimension.id })); say(p, bot, "帰る場所、登録されました。……ありがとうございます", true); }
      else say(p, bot, "近くにコンテナが見つかりません。チェストを見ながら、もう一度どうぞ", true);
    }
    if (res.selection === 5) { // cycle1832 F1: フォーム応答は非同期のため、実行時点で距離・次元を再検査する (U1 と同型の fail-closed)
      let inRange = false; try { inRange = p.dimension.id === bot.dimension.id && dist(bot.location, p.location) <= DELIVER_RANGE; } catch {}
      if (!inRange) { say(p, bot, "距離が離れています。近くで、もう一度どうぞ", true); }
      else { const oc = invOf(p); if (oc) { const res2 = transferFiltered(bot, oc, null); say(p, bot, res2.moved > 0 ? `${res2.moved}個、お渡ししました` : "渡せるものは、今はありません", true); } }
    }
    if (res.selection === 6) {
      const cont = invOf(bot); let used = 0; if (cont) for (let i = 0; i < cont.size; i++) if (cont.getItem(i)) used++;
      let misTxt = "";
      if (r.mission) { const s = missionSummary(r.mission); if (s) misTxt = ` / 指示: ${nameOfItem(s.target)} ${s.currentStep ? `${s.currentStep.have}/${s.currentStep.need}` : ""}（${s.status}）`; }
      p.sendMessage(`§b<リゼ>§r 状態: モード ${mode} / 所持 ${used}/27 / 回収${st.pickup || 0}・お届け${st.deliver || 0}・入庫${st.deposit || 0} / 好感度 ${dp(bot, "cb_bond", 30)} / 脳ルール ${RULE_COUNT}件 稼働中${misTxt}`);
      if (r.failCount > 0) { const recent = (r.failLog || []).slice(-3).map((f) => f.where).join("、"); p.sendMessage(`§7（記録：失敗 ${r.failCount}件記録あり。直近：${recent}）§r`); }
      try { const tLines = formatTraceSummaryLines(r.trace?.summarize?.()); for (const tl of tLines) p.sendMessage(tl); } catch {} // Phase4 表示 U1 (cycle2239): 直近の判断（記録）を最大2行だけ表示。表示のみで判断には使わない
      try { const fLines = formatFailSummaryLines(r.failAgg); for (const fl of fLines) p.sendMessage(fl); } catch {} // Phase4 S3a: 失敗傾向の表示。読み手はこの表示経路のみで、判断には使わない
      try { const iLines = formatInspectSummaryLines(summarizeInspectAgg(r.inspectAgg)); for (const il of iLines) p.sendMessage(il); } catch {} // Phase6 INSPECT S0-1.5 (cycle0252): 集計の表示読み手はこの1点のみ。判断・計画・ゲートには使わない
    }
    if (res.selection === 7) { wdps(`cb_savedinv:${p.id}`, JSON.stringify(serializeInv(bot))); const ec = equipCoreOf(bot, r); if (ec) { try { wdps(`cb_saved_equip:${p.id}`, ec.serialize()); } catch {} } try { flushFailAgg(bot, r); } catch {} try { flushExp(bot, r); } catch {} try { bodies.release(r); } catch {} /* 6-ML: 消滅前 flush 相乗り */ try { bot.remove(); } catch {} bots.delete(bot.id); } // S3b: 消滅前に failAgg を flush (実体がある selection 7 が実効箇所。メインループの不在検出箇所は entity が無く flush 不能)
    if (res.selection === 8) {
      if (r.mission && r.mission.status === "active") {
        const cf = new ActionFormData();
        cf.title("指示の受け直し");
        cf.body("今の指示の途中です。やめて、新しい指示を受けますか");
        cf.button("やめて受け直す", "textures/items/lize_remote");
        cf.button("今のまま", "textures/items/lize_remote");
        cf.show(p).then((c2) => { if (!c2.canceled && c2.selection === 0) { foldGatherBuildPlan(bot, p, r, "order_replaced", r.mission); r.mission = null; clearPlanRecords(r); persistMission(bot, r, true); dps(bot, "cb_order", ""); openOrderForm(p, bot); } }).catch(() => {});
      } else openOrderForm(p, bot);
    }
    if (res.selection === 9) openBuildMenu(p, bot);
    if (res.selection === 10) openMissionStatus(p, bot);
    if (res.selection === 11) {
      const core = equipCoreOf(bot, r);
      if (core) {
        const api = createEquipmentApi(p, bot, core, { invOf, hpOf, say, nameOfItem, onEquipEvent: (kind, fromOwner) => { r.equipChanged = kind; r.equipChangedAt = Date.now(); r.equipFromOwner = !!fromOwner; }, onEquipResult: (res) => recordEquipExp(r, res, "equip_ui") }); // 6-ML U4: UI経路の装備成否を EQUIP として記録 (記録のみ)
        openEquipUI(p, { forms: { ActionFormData, ModalFormData }, api }).catch(() => {});
      }
    }
    if (res.selection === 13) openWarehouseMenu(p, bot);
    if (res.selection === 12) {
      // v0.4.57: チャットイベントが使えない環境向けの文字入力。処理はチャットと同一 (handleChatMessage)。
      const mf = new ModalFormData();
      mf.title("リゼへの指示・会話");
      mf.textField("チャットと同じ言葉で入力してください（例：鉄を10個集めて／ついてきて）", "ここに入力");
      mf.show(p).then((mres) => {
        if (mres.canceled) return;
        const text = (mres.formValues && mres.formValues[0]) ? String(mres.formValues[0]).trim() : "";
        if (text) system.run(() => handleChatMessage(p, text));
      }).catch(() => {});
    }
  }).catch(() => {});
}

// 倉庫 W1 リモコンUI (cycle1604, selection 13): 候補の確認と一括登録/除外/破棄。
// 候補供給は refreshWarehouseCandidates (既知コンテナ) が担い、ここでは新規走査をしない。
// 登録時は水平隣接する候補同士をラージチェストの組として pairKey で結ぶ (どちらの半分でも同じ収納先)。
// 倉庫 W2 (cyc1939): 登録箱の実コンテナを boxes 形式へスナップショットする。
// 開けない・未読込・破損した箱は null を返し、呼び出し側が「開けなかった箱」として数える (粘らない)。
function warehouseRawStackOf(stack) {
  try {
    if (!stack) return null;
    let durability = null; try { const dc = stack.getComponent?.("minecraft:durability"); if (dc && typeof dc.damage === "number") durability = dc.damage; } catch {}
    let enchants = []; try { const ec = stack.getComponent?.("minecraft:enchantable"); const list = ec?.getEnchantments?.(); if (Array.isArray(list)) enchants = list.map((e) => `${e?.type?.id || e?.id || ""}:${e?.level ?? 1}`).filter((s) => !s.startsWith(":")); } catch {}
    return { typeId: stack.typeId, name: stack.nameTag || null, durability, enchants, amount: stack.amount };
  } catch { return null; }
}
function warehouseContainerOf(bot, regBox) {
  try {
    const dimId = typeof regBox?.dim === "string" ? regBox.dim : null;
    const key = typeof regBox?.key === "string" ? regBox.key : "";
    const xyz = key.split("|")[1]; if (!xyz) return null;
    const [x, y, z] = xyz.split(",").map(Number);
    if (![x, y, z].every(Number.isFinite)) return null;
    let dim = bot.dimension; try { if (dimId && dimId !== bot.dimension?.id) dim = world.getDimension(dimId); } catch { return null; }
    if (!dim) return null;
    const block = dim.getBlock({ x, y, z }); if (!block || !isContainerBlock(block.typeId)) return null;
    const cont = block.getComponent("minecraft:inventory")?.container; if (!cont) return null;
    return { cont, block };
  } catch { return null; }
}
function snapshotWarehouseBox(bot, regBox) {
  try {
    const got = warehouseContainerOf(bot, regBox); if (!got) return null;
    const raw = [];
    for (let i = 0; i < got.cont.size; i++) { let st = null; try { st = got.cont.getItem(i); } catch {} raw.push(warehouseRawStackOf(st)); }
    return boxSnapshotOf(regBox, raw);
  } catch { return null; }
}
// 倉庫 W2 (cyc1939): 整理の実行本体。在庫調査→計画→各 move を移動直前に再確認してから実スロットへ適用する。
// 再確認で食い違った move 以降は止め、適用済み件数と止まった理由を報告する (消失・複製・投棄なし)。
function runWarehouseSort(p, bot, r) {
  try {
    const reg = r.warehouse || createWarehouseRegistry();
    const allRegBoxes = (Array.isArray(reg.boxes) ? reg.boxes : []).filter((b) => b && b.role !== "excluded");
    const seenCanon = new Set(); const regBoxes = allRegBoxes.filter((b) => { let ck = b.key; try { ck = canonicalKeyOf(reg, b.key) || b.key; } catch {} if (seenCanon.has(ck)) return false; seenCanon.add(ck); return true; }); // cyc2367 WH-RECHECK-01: ラージチェストは代表1件だけ snapshot する
    if (!regBoxes.length) { say(p, bot, "登録された箱がまだありません。リモコンの倉庫メニューで候補を登録してください", true); return; }
    const snaps = []; const contByKey = new Map(); let unreadable = 0; let recheckDirty = false;
    for (const b of regBoxes) { const s = snapshotWarehouseBox(bot, b); if (s) { snaps.push(s); const got = warehouseContainerOf(bot, b); if (got) contByKey.set(b.key, got.cont); if (b.needsRecheck) { try { r.warehouse = confirmBox(r.warehouse || reg, b.key); recheckDirty = true; } catch {} } } else { unreadable++; if (!b.needsRecheck) { try { r.warehouse = markNeedsRecheck(r.warehouse || reg, b.key); recheckDirty = true; } catch {} } } }
    if (recheckDirty) { try { saveWarehouse(bot, r); } catch {} } // cyc2367 WH-RECHECK-01: 印の立て下げは対で保存は最大1回
    if (!snaps.length) { say(p, bot, "登録された箱を1つも開けませんでした。近くの箱だけが対象です", true); return; }
    const plan = planSortMoves(buildSortInput(reg, snaps));
    if (!plan.moves.length) { say(p, bot, `整理しました。移動はありませんでした${plan.leftovers.length ? `。行き先が分からない物が${plan.leftovers.length}件、元の箱に残っています` : ""}${unreadable ? `。開けなかった箱が${unreadable}件あります` : ""}`, true); return; }
    let applied = 0; let stopReason = null;
    for (const mv of plan.moves) {
      // 移動直前の再確認: 関係する2箱だけを撮り直して verifyMove に通す
      const fresh = [];
      for (const b of regBoxes) if (b.key === mv.fromKey || b.key === mv.toKey) { const s = snapshotWarehouseBox(bot, b); if (s) fresh.push(s); }
      const v = verifyMove(fresh, mv);
      if (!v.ok) { stopReason = v.reason; break; }
      const fromCont = contByKey.get(mv.fromKey); const toCont = contByKey.get(mv.toKey);
      if (!fromCont || !toCont) { stopReason = "container_missing"; break; }
      let fs = null, ts = null; try { fs = fromCont.getItem(mv.fromSlot); ts = toCont.getItem(mv.toSlot); } catch {}
      if (!fs) { stopReason = "from_empty"; break; }
      try {
        const moving = fs.clone(); moving.amount = mv.amount;
        if (ts) { const merged = ts.clone(); merged.amount = ts.amount + mv.amount; toCont.setItem(mv.toSlot, merged); }
        else toCont.setItem(mv.toSlot, moving);
        const remain = fs.amount - mv.amount;
        if (remain > 0) { const rem = fs.clone(); rem.amount = remain; fromCont.setItem(mv.fromSlot, rem); }
        else fromCont.setItem(mv.fromSlot, undefined);
      } catch { stopReason = "apply_error"; break; }
      applied++;
    }
    const sum = summarizeSort(plan, { ok: stopReason === null, applied, reason: stopReason, remaining: plan.moves.slice(applied) });
    if (stopReason) say(p, bot, `整理を途中で止めました。${applied}件は移動済みです。理由は ${stopReason} で、残り${sum.remaining}件は元の箱に残っています`, true);
    else say(p, bot, `整理しました。${applied}件を移動しました${sum.leftoverCount ? `。行き先が分からない物が${sum.leftoverCount}件、元の箱に残っています` : ""}${unreadable ? `。開けなかった箱が${unreadable}件あります` : ""}`, true);
  } catch { try { say(p, bot, "整理の途中で問題が起きました。移動済みの分以外は元の箱に残っています", true); } catch {} }
}
function openWarehouseMenu(p, bot) {
  const r = rt(bot);
  try { refreshWarehouseCandidates(bot, r); } catch {}
  const reg = r.warehouse || createWarehouseRegistry();
  const boxes = Array.isArray(reg.boxes) ? reg.boxes : [];
  const cands = Array.isArray(reg.candidates) ? reg.candidates : [];
  const roleName = { intake: "投入口", dest: "仕分け先", source: "整理対象", excluded: "除外", unclassified: "未分類" };
  const lines = boxes.slice(0, 8).map((b) => `登録: ${roleName[b.role] || b.role}${b.category ? `（${categoryLabelOf(b.category) || b.category}）` : ""}${b.needsRecheck ? "（再確認が必要）" : ""} ${b.key}`);
  const candLines = cands.slice(0, 8).map((c) => `候補: ${c.key}`);
  const form = new ActionFormData();
  form.title("倉庫の登録・確認");
  form.body(`登録済み ${boxes.length}件 / 候補 ${cands.length}件\n${[...lines, ...candLines].join("\n") || "まだ何もありません。チェストを置いて開けると、候補に上がります"}`);
  // cyc1908: 仕分け先はカテゴリ別ボタンで登録し、category を台帳へ渡す (従来は category 無しで仕分け核の category 一致が発火しなかった)
  for (const cat of WAREHOUSE_CATEGORIES) form.button(`候補を仕分け先（${cat.label}）に登録`, "textures/items/lize_remote");
  form.button("候補を仕分け先（カテゴリなし）に登録", "textures/items/lize_remote");
  form.button("候補を除外する", "textures/items/lize_remote");
  form.button("候補を消す（登録しない）", "textures/items/lize_remote");
  form.button("登録した箱を整理する", "textures/items/lize_remote");
  form.button("閉じる", "textures/items/lize_remote");
  const catCount = WAREHOUSE_CATEGORIES.length;
  const selExcluded = catCount + 1, selClear = catCount + 2, selSort = catCount + 3, selClose = catCount + 4;
  form.show(p).then((res) => {
    if (res.canceled || res.selection === selClose) return;
    if (res.selection === selSort) { const rr2 = rt(bot); system.run(() => runWarehouseSort(p, bot, rr2)); return; }
    const rr = rt(bot); if (!rr.warehouse) rr.warehouse = createWarehouseRegistry();
    const cur = (Array.isArray(rr.warehouse.candidates) ? rr.warehouse.candidates : []).slice();
    if (!cur.length) { say(p, bot, "候補は、今はありません", true); return; }
    if (res.selection === selClear) { let w = rr.warehouse; for (const c of cur) w = removeCandidate(w, c.key); rr.warehouse = w; saveWarehouse(bot, rr); say(p, bot, `候補${cur.length}件を消しました。登録はしていません`, true); return; }
    const role = res.selection === selExcluded ? "excluded" : "dest";
    const category = role === "dest" && res.selection < catCount ? WAREHOUSE_CATEGORIES[res.selection].id : null;
    // ラージチェスト推定: 同じ次元・同じ y で水平に隣接する候補同士を組にする
    const pairOf = (c) => { try { const [dim, xyz] = c.key.split("|"); const [x, y, z] = xyz.split(",").map(Number); const mate = cur.find((o) => { if (o.key === c.key) return false; const [d2, xyz2] = o.key.split("|"); if (d2 !== dim) return false; const [x2, y2, z2] = xyz2.split(",").map(Number); return y2 === y && Math.abs(x2 - x) + Math.abs(z2 - z) === 1; }); return mate ? mate.key : null; } catch { return null; } };
    let w = rr.warehouse; let okCount = 0;
    for (const c of cur) { const out = registerBox(w, { key: c.key, dim: c.dim, role, category, pairKey: pairOf(c) }); if (out && out.ok) { w = out.reg; okCount++; } }
    rr.warehouse = w; saveWarehouse(bot, rr);
    say(p, bot, role === "dest" ? `候補${okCount}件を仕分け先${category ? `（${categoryLabelOf(category) || category}）` : ""}に登録しました` : `候補${okCount}件を除外に登録しました。今後、仕分け先には使いません`, true);
  }).catch(() => {});
}

// 指示フォーム（order_ui_spec.md §2）: 素材は sourcing の名前解決で検証する
function openOrderForm(p, bot) {
  const r = rt(bot);
  const form = new ModalFormData();
  form.title("指示を出す");
  form.textField("素材（例: 鉄 / ダイヤモンド / 原木）", "素材名");
  form.textField("個数（1〜10000）", "例: 100", { defaultValue: "16" });
  form.dropdown("敵への対応", ["任せる", "無視して進む", "倒しながら行く", "避けて通る"], { defaultValueIndex: 0 });
  form.toggle("寄り道も頼む", { defaultValue: false });
  form.textField("寄り道の素材（任意）", "素材名");
  form.textField("寄り道の個数（1〜10000）", "例: 32", { defaultValue: "8" });
  form.dropdown("行き先", ["近場で探す", "洞窟方面", "集めたら拠点へ入庫"], { defaultValueIndex: 0 });
  form.show(p).then((res) => {
    if (res.canceled) return;
    const [matText, countText, hostileIdx, detourOn, detourText, detourCountText, destIdx] = res.formValues;
    const parseCount = (v, def) => { const n = parseInt(String(v ?? "").replace(/[^0-9]/g, ""), 10); return Number.isFinite(n) && n > 0 ? Math.min(10000, n) : def; };
    const count = parseCount(countText, 16);
    const detourCount = parseCount(detourCountText, 8);
    const entry = findSources(String(matText || "").trim());
    if (!entry) { say(p, bot, `『${matText}』は分かりませんでした。素材の名前を変えて、もう一度どうぞ`, true); return; }
    const hostiles = ["avoid", "ignore", "fight", "avoid"][hostileIdx] || "avoid";
    const sideTasks = [];
    if (detourOn && detourText) { const de = findSources(String(detourText).trim()); if (de) sideTasks.push({ kind: "gather", target: de.item, amount: detourCount }); }
    // dest=洞窟方面は地下優先探索が未対応のため、最小実装では近場探索と同じ扱い（申し送り参照）
    startMission(bot, p, r, { kind: "gather", target: entry.item, amount: count, constraints: { hostiles }, sideTasks, returnTo: destIdx === 2 ? "home" : "owner" });
  }).catch(() => {});
}

// 建築フロー（order_ui_spec.md §3）: 図面選択 → 材料リスト → 集めてから/ある分で
function openBuildMenu(p, bot) {
  const r = rt(bot);
  const form = new ActionFormData();
  form.title("建築を頼む");
  form.body("建てるものを選んでください。場所は、あなたの今の位置が原点です");
  for (const bp of BLUEPRINTS) form.button(bp.name, "textures/items/lize_remote");
  form.button("やめる", "textures/items/lize_remote");
  form.show(p).then((res) => {
    if (res.canceled || res.selection >= BLUEPRINTS.length) return;
    const bp = BLUEPRINTS[res.selection];
    const summary = materialsSummaryOf(bp.blocks);
    const invB = countInv(bot), invO = countInv(p);
    const lines = Object.entries(summary).map(([item, n]) => { const have = (invB[item] || 0) + (invO[item] || 0); return `${nameOfItem(item)}: 必要${n} / あと${Math.max(0, n - have)}`; });
    const f2 = new ActionFormData();
    f2.title(bp.name);
    f2.body(`材料リスト（リゼとあなたの所持品で計算）\n${lines.join("\n")}`);
    f2.button("集めてから建てる", "textures/items/lize_remote");
    f2.button("ある分で建てる", "textures/items/lize_remote");
    f2.button("やめる", "textures/items/lize_remote");
    f2.show(p).then((res2) => {
      if (res2.canceled || res2.selection === 2) return;
      startBuild(bot, p, r, bp.name, buildOrderOf(bp.blocks), p.location, res2.selection === 0);
    }).catch(() => {});
  }).catch(() => {});
}

// 指示の確認・中止（order_ui_spec.md §4）
function openMissionStatus(p, bot) {
  const r = rt(bot);
  const lines = [];
  if (r.mission) { const s = missionSummary(r.mission); if (s) lines.push(`指示: ${nameOfItem(s.target)} ${s.currentStep ? `${s.currentStep.have}/${s.currentStep.need}` : ""}（${s.status}、段階 ${s.stepsDone}/${s.stepsTotal}）`); }
  if (r.buildPlan) lines.push(`建築: ${r.buildPlan.name}（${r.buildPlan.stage === "gather" ? "材料集め中" : `設置 ${r.buildPlan.placed} 箇所`}）`);
  if (!lines.length) { say(p, bot, "受けている指示は、今はありません", true); return; }
  const form = new ActionFormData();
  form.title("指示の確認");
  form.body(lines.join("\n"));
  form.button("このまま続ける", "textures/items/lize_remote");
  form.button("指示をやめる", "textures/items/lize_remote");
  form.show(p).then((res) => { if (!res.canceled && res.selection === 1) cancelMission(bot, p, r); }).catch(() => {});
}

world.afterEvents.entityDie.subscribe((ev) => {
  const dead = ev.deadEntity;
  if (dead.typeId === "minecraft:player") wdps(`cb_death:${dead.id}`, JSON.stringify({ dim: dead.dimension.id, x: dead.location.x, y: dead.location.y, z: dead.location.z, t: Date.now() }));
  // ミッション討伐数の近似カウント: 敵対モブが死に、Bot が近傍（7以内）にいればその Bot の討伐として数える
  if (dead.typeId !== "minecraft:player" && dead.typeId !== BOT_ID) {
    let hostile = GVC_HOSTILE_SET.has(dead.typeId);
    if (!hostile) { try { hostile = !!dead.getComponent("minecraft:type_family")?.hasTypeFamily("monster"); } catch {} }
    // HUNT-ANIMAL-PROGRESS-01 (cyc2385・BLOCKER是正): 計上の門は敵対性でなく現行 hunt ステップの対象指定 (huntKillCounts が単一の正)。
    // 種別指定の動物 (牛等) は敵対でなくても数え、汎用指定 "hostile" では従来どおり敵対だけを数える。
    for (const [bid, rr] of bots) { let b = null; try { b = world.getEntity(bid); } catch {} if (b && b.dimension.id === dead.dimension.id && dist(b.location, dead.location) < 7) { // HUNT-SUBST-01 (cyc2364): 現行 hunt ステップの対象種別 (または汎用指定) に一致する死亡だけを数える。加害者の厳密な帰属は正式版APIで担保しにくいため最低ラインは種別一致とする
      try { const mm = rr.mission; const st = mm && mm.status === "active" ? (mm.steps || [])[mm.currentStep || 0] : null; if (st && st.type === "hunt_entity" && huntKillCounts(st.target, dead.typeId, hostile)) rr.missionKills = (rr.missionKills || 0) + 1; } catch {} } }
  }
  if (dead.typeId === BOT_ID) {
    const oid = dp(dead, "cb_owner", "");
    if (oid) { wdps(`cb_savedinv:${oid}`, JSON.stringify(serializeInv(dead))); const rr = bots.get(dead.id); if (rr?.equipCore) { try { wdps(`cb_saved_equip:${oid}`, rr.equipCore.serialize()); } catch {} } const p = getPlayer(oid); if (p) say(p, dead, "……少し、休みます。リモコンで呼んでください。中身は保持しています", true); }
    try { const rr2 = bots.get(dead.id); if (rr2) bodies.release(rr2); } catch {}
    bots.delete(dead.id);
  }
});
world.afterEvents.playerSpawn.subscribe((ev) => { const ort = ownerRt.get(ev.player.id) || {}; ort.spawnAt = Date.now(); ort.lastMoveAt = Date.now(); ownerRt.set(ev.player.id, ort); });
world.afterEvents.playerBreakBlock.subscribe((ev) => { const ort = ownerRt.get(ev.player.id) || {}; ort.breakAt = Date.now(); try { ort.breakLoc = ev.block?.location ? { x: ev.block.location.x, y: ev.block.location.y, z: ev.block.location.z } : null; } catch { ort.breakLoc = null; } ownerRt.set(ev.player.id, ort); }); // WORKGLANCE-01 (cycle1728): keep event cell for the glance
world.afterEvents.playerPlaceBlock.subscribe((ev) => { const ort = ownerRt.get(ev.player.id) || {}; ort.placeAt = Date.now(); try { ort.placeLoc = ev.block?.location ? { x: ev.block.location.x, y: ev.block.location.y, z: ev.block.location.z } : null; } catch { ort.placeLoc = null; } ownerRt.set(ev.player.id, ort); }); // WORKGLANCE-01 (cycle1728)
system.runInterval(() => { for (const p of world.getAllPlayers()) { const ort = ownerRt.get(p.id) || {}; try { const v = p.getVelocity(); if (Math.abs(v.x) + Math.abs(v.z) > 0.05) ort.lastMoveAt = Date.now(); } catch {} ownerRt.set(p.id, ort); } }, 20);

// チャット反応（v0.3.0）: 入力正規化 → 提案収集（指示/QA/ツール/知識/ロア/雑談）→ chat_arbiter 調停 → 応答
// 勝者が無ければ composer のフォールバック（成功応答で streak リセット）。
function convOf(r) {
  if (!r.conv) { try { r.conv = createConversation(); } catch { r.conv = null; } }
  return r.conv || { hear() {}, noteBot() {}, resolveReference: () => null, matchesPrev: () => false, getContext: () => ({}) };
}
function matchCat(cats, msg, needPrev, r, conv) {
  for (const cat of cats) {
    if (needPrev) {
      let ok = false; try { ok = !!conv.matchesPrev(cat.prev || []); } catch {}
      if (!ok) ok = !!(r.lastTopic && Date.now() - r.lastTopicAt < 90000 && (cat.prev || []).includes(r.lastTopic));
      if (!ok) continue;
    }
    let keyLen = 0;
    for (const k of (cat.keys || [])) { const kk = String(k).toLowerCase(); if (kk && msg.includes(kk)) keyLen = Math.max(keyLen, kk.length); }
    if (keyLen > 0) return { cat, keyLen };
  }
  return null;
}
function applyChatAct(p, bot, r, act) {
  if (act === "follow") dps(bot, "cb_mode", "follow");
  if (act === "stay_anchor") { dps(bot, "cb_mode", "stay"); try { const bl = bot.location; setAnchor(bot, r, { x: bl.x, y: groundY(bot.dimension, bl.x, bl.z, bl.y, bl.y), z: bl.z }, bot.dimension.id); } catch { setAnchor(bot, r, { ...bot.location }, bot.dimension.id); } } // BH-04/BH-11: メニュー経路と同形に DP 保存＋地面寄せ
  if (act === "patrol_home") dps(bot, "cb_mode", "work");
  if (act === "return_home") { const h = homeOf(bot); const ep = homeEntryPoint(bot, h); if (ep) r.target = ep; }
  if (act === "go_owner") { try { const want = { x: p.location.x + 1, y: p.location.y, z: p.location.z }; teleportNearOwnerGuarded(bot, r, p.dimension, want, p.location); } catch {} } // queue3 step2: place ゲート経由
}
function parserOrderToMission(o) {
  const t = o.target || {};
  const hostiles = o.constraints?.hostiles === "engage" ? "fight" : o.constraints?.hostiles === "ignore" ? "ignore" : "avoid";
  const sideTasks = (o.sideTasks || []).map((s) => { const st = s.target || {}; const id = typeof st === "string" ? st : (st.item || st.block || st.entity); return id ? { kind: s.kind === "hunt" ? "hunt" : "gather", target: id, amount: s.amount ?? 8 } : null; }).filter(Boolean);
  const forbiddenTargets = [...new Set((o.negations || []).map((n) => n?.target?.item || n?.target?.block || n?.target?.entity).filter(Boolean))].filter((id) => id !== (t.item || t.block || t.entity));
  const aoId = o.allowOnly?.target ? (typeof o.allowOnly.target === "string" ? o.allowOnly.target : (o.allowOnly.target.item || o.allowOnly.target.block || o.allowOnly.target.entity || null)) : null;
  return { kind: o.kind === "hunt" ? "hunt" : "gather", target: t.item || t.block || t.entity || null, amount: o.amount ?? 32, constraints: { hostiles, forbiddenTargets, caps: Array.isArray(o.caps) ? o.caps : [], window: o.constraints?.window ? { raw: o.constraints.window.raw || "", kind: o.constraints.window.kind || "" } : null, allowOnly: aoId ? { target: aoId, verb: o.allowOnly.verb ?? null } : null }, sideTasks, returnTo: o.returnTo === "home" ? "home" : "owner", name: t.name || null, tool: o.tool ?? null, placement: o.placement ?? null, gearSet: Array.isArray(o.gearSet) ? o.gearSet : null }; // 0-C2 (cycle1215): caps を mission 制約へ同梱 (保持のみ)。0-C4 (cycle1321): 道具と設置位置も保持する。R-C2-4 (cyc2380): window 写しも保持する。R-C2-6 U6-2 (cyc2384): 注文自身の allowOnly も写す (永続化はしない)
}

// Phase5 否定配線 (NEGW): 禁止・聞き返しは mission を作らない。記録と復唱/聞き返しのみ。
const FORBID_VERB_JP = { gather: "集めません", build: "作りません", hunt: "倒しません", deliver: "持ってきません" };
function recordSessionForbids(bot, r, o) {
  if (!Array.isArray(r.sessionForbids)) r.sessionForbids = [];
  for (const n of o?.negations || []) {
    const id = n?.target?.item || n?.target?.block || n?.target?.entity || null;
    if (!id) continue;
    const nid = normForbiddenId(id); // forbids G4-3 (cycle0505): 記録側も norm してから dedupe/保存する
    if (!r.sessionForbids.some((f) => normForbiddenId(f.target) === nid && f.verb === (n.verb ?? null))) r.sessionForbids.push({ target: nid, verb: n.verb ?? null, at: Date.now() });
  }
  if (r.sessionForbids.length > 32) r.sessionForbids = r.sessionForbids.slice(-32);
  try { dps(bot, "cb_forbids", serializeForbids(r.sessionForbids)); } catch {} // Phase5 (cycle1923): 再召喚・再起動を跨いで禁止を保持する // cycle2036: 保存を serializeForbids へ統一 (非文字列 verb の復元時拡大を防ぐ)
}
function forbidTargetName(n) { return n?.target?.name || nameOfItem(n?.target?.item || n?.target?.block || n?.target?.entity || ""); }
// 0-C2 (cycle1604): allowOnly の代入と DP 保存は必ずこの1点を通す (保存漏れで再召喚時に静かに消える事故の再発防止)
function setAllowOnly(bot, r, v) { try { r.allowOnly = v; dps(bot, "cb_allowonly", serializeAllowOnly(v)); } catch {} }
// 0-C2 (cyc2020): caps の代入と DP 保存は必ずこの1点を通す (allowOnly と同型。保存漏れで再召喚時に静かに消える事故の再発防止)
function setCaps(bot, r, v) { try { r.caps = v; dps(bot, "cb_caps", serializeCaps(v)); } catch {} }
// 0-C2 (cycle1604): 制限の解除。allowOnly と sessionForbids の両方へ適用し、両 DP キーを保存する。
// scope:"all" は allowOnly のみ全解除する (禁止の一括解除は誤爆範囲が大きいため対象指定がある場合だけ外す)。
function releaseRestrictions(bot, r, o) {
  const tid = o.releaseTarget?.item || o.releaseTarget?.block || o.releaseTarget?.entity || null;
  let changed = false; const notes = [];
  try {
    const before = r.allowOnly;
    const after = o.releaseScope === "all" ? clearAllowOnly(before, null) : (tid ? clearAllowOnly(before, tid) : before);
    if (after !== before) { setAllowOnly(bot, r, after); changed = true; notes.push("限定は外しました"); }
  } catch {}
  if (tid) {
    try {
      const res = removeSessionForbids(r.sessionForbids, tid);
      if (res.removed.length) { r.sessionForbids = res.list; dps(bot, "cb_forbids", serializeForbids(res.list)); changed = true; notes.push(`${o.releaseTarget?.name || nameOfItem(tid)}は対象に戻します`); }
    } catch {}
    try { // 0-C2 (cyc2020): 対象指定の解除はその対象の上限も外す (従来は解除経路自体が無かった)
      const beforeCaps = Array.isArray(r.caps) ? r.caps : [];
      const keptCaps = beforeCaps.filter((c) => { const ct = typeof c?.target === "string" ? c.target : (c?.target?.item || c?.target?.block || c?.target?.entity || null); return !ct || normForbiddenId(ct) !== normForbiddenId(tid); });
      if (keptCaps.length !== beforeCaps.length) { setCaps(bot, r, keptCaps); changed = true; notes.push(`${o.releaseTarget?.name || nameOfItem(tid)}の上限は外しました`); }
    } catch {}
  }
  if (o.releaseScope === "all") { // 0-C2 (cyc2020): 全解除は上限も全て外す (allowOnly の全解除と揃える)
    try { if (Array.isArray(r.caps) && r.caps.length) { setCaps(bot, r, []); changed = true; notes.push("上限は外しました"); } } catch {}
  }
  return { changed, notes };
}
function startOrderFromParser(p, bot, r, o) {
  // 0-C2 (cycle1215): 条件付き注文は即時発行しない。条件を保持して保留し、その旨を返す。
  if (o.constraints?.condition) {
    // R-C2-2 (cyc2372): 評価方法が無い条件 (custom 等) は発火口が無いため保留にしない。
    // 「保留します」と受理したように見せず、その場で何ができないかを明示する (0-C7)。
    if (!isEvaluableCondition(o.constraints.condition)) {
      say(p, bot, `その条件「${o.constraints.condition.raw || "その条件"}」は、私では判定できません。条件が来ても自動では始められないので、この指示は受けていません。条件なしで頼むか、条件が来たときに声をかけてください`, true);
      return;
    }
    // R-C2-1 (cyc2374): 既存の条件保留がある場合は無言で上書きせず、置換した事実を明示する。保持形・TTL・上書き自体の挙動は変えない。
    const replacedPending = !!r.pendingConditionOrder;
    try { setPendingCondition(bot, r, { order: o, at: Date.now(), ownerId: p?.id ?? null }); } catch {}
    // R-C2-4 (cyc2380): window 形は「その間だけ動いて、終わったら止める」ことを受理時点で伝える。
    if (conditionRole(o.constraints.condition) === "window") say(p, bot, `分かりました。${replacedPending ? "前の条件の指示は置き換えます。" : ""}${o.constraints.condition.raw}だけ、${o.target?.name || "その対象"}${o.amount ? o.amount + "個" : ""}の指示をします。その間が終わったら止めます`, true);
    else say(p, bot, `分かりました。${replacedPending ? "前の条件の指示は置き換えます。" : ""}${o.constraints.condition.raw}、${o.target?.name || "その対象"}${o.amount ? o.amount + "個" : ""}の指示を始めます。それまでは保留します`, true);
    return;
  }
  // 0-C2 (cycle1215): 上限だけの発話 (kind:"cap") は禁止として記録せず、上限として保持する。
  if (o.kind === "cap") {
    const list = (o.caps || []).filter((c) => c?.target);
    try { setCaps(bot, r, [...(Array.isArray(r.caps) ? r.caps : []), ...list.map((c) => ({ target: c.target?.item || c.target?.block || c.target?.entity || null, cap: c.cap, verb: c.verb ?? null, at: Date.now() }))].slice(-16)); } catch {}
    if (list.length) say(p, bot, `分かりました。${list.map((c) => `${c.target?.name || ""}は${c.cap}までです`).join("。")}。それ以上はしません`, true);
    else say(p, bot, "分かりました。その上限で止めます", true);
    return;
  }
  // 0-C2 (cycle1604): 制限の解除は forbid 分岐より前に処理する (否定経路へ流すと再び禁止になる)
  if (o.kind === "unforbid") {
    const rel = releaseRestrictions(bot, r, o);
    if (rel.changed) say(p, bot, `分かりました。${rel.notes.join("。")}。`, true);
    else if (o.releaseScope === "all") say(p, bot, "分かりました。限定はかかっていません", true);
    else say(p, bot, "その対象への制限は、かかっていません", true);
    return;
  }
  // Phase5 否定配線: build/gather の mission 実行中ガードより前に置くこと
  if (o.kind === "forbid") {
    recordSessionForbids(bot, r, o);
    const list = (o.negations || []).filter((n) => n?.target);
    if (list.length === 0) { say(p, bot, "分かりました。その件はしません", true); return; }
    const parts = list.map((n) => `${forbidTargetName(n)}は${n.verb ? (FORBID_VERB_JP[n.verb] || "しません") : "対象にしません"}`);
    say(p, bot, `分かりました。${parts.join("。")}。`, true);
    const m = r.mission;
    if (m && m.status === "active" && !r.ltLegActive) {
      const hit = list.find((n) => (n.target?.item || n.target?.block || n.target?.entity) === m.order?.target && (n.verb == null || n.verb === m.order?.kind || (n.verb === "deliver" && m.order?.kind === "gather")));
      if (hit) { cancelMission(bot, p, r, true); say(p, bot, `今の指示も止めました。${forbidTargetName(hit)}が対象でした`, true); }
    }
    return;
  }
  if (o.kind === "clarify") {
    // 0-C2 (cycle1215): 「X以外は〜しないで」は X が唯一の許可対象。X を禁止に記録せず allowOnly として保持する (逆転の是正)。
    if (o.allowOnly?.target) {
      setAllowOnly(bot, r, { target: o.allowOnly.target?.item || o.allowOnly.target?.block || o.allowOnly.target?.entity || null, verb: o.allowOnly.verb ?? null, at: Date.now() });
      say(p, bot, `分かりました。${forbidTargetName({ target: o.allowOnly.target })}以外は対象にしません`, true);
      // 0-C2 (cycle1604, A02-P3): 設定時点で実行中の mission が許可外なら、forbid 分岐と同形に止める
      try {
        const m = r.mission;
        if (m && m.status === "active" && !r.ltLegActive && m.order?.target && !isAllowedByAllowOnly(r.allowOnly, m.order.target, m.order?.kind)) { cancelMission(bot, p, r, true); say(p, bot, "今の指示も止めました。許可された対象ではありませんでした", true); }
      } catch {}
      return;
    }
    const reason = o.unresolved?.[0]?.reason || "";
    // Phase5 clarify保持: 聞き返した内容を会話状態へ1件だけ保持し、次の短い回答で再開できるようにする
    try {
      const cands = (o.retainedCandidates || []).slice(0, 2);
      const _cc = convOf(r); if (_cc?.setPendingClarify) _cc.setPendingClarify({
        slot: o.unresolved?.[0]?.slot || "target",
        reason,
        unresolvedAll: o.unresolved || [],
        negations: o.negations || [],
        retainedCandidates: cands,
        candidates: cands.map((c) => { const tg = c?.target || {}; return { id: tg.item || tg.block || tg.entity || null, label: tg.name || "", kind: tg.entity ? "entity" : "item" }; }),
        known: { constraints: o.constraints || null, returnTo: o.returnTo || "owner", raw: o.raw || null },
        lastClarifyText: null,
      });
    } catch {}
    const nm = (o.negations || []).find((n) => n?.target);
    if (reason === "excluded_only") { try { recordSessionForbids(bot, r, { negations: o.unresolved?.[0]?.negations?.length ? o.unresolved[0].negations : (o.negations || []) }); } catch {} say(p, bot, `分かりました。${nm ? forbidTargetName(nm) + "は対象にしません" : "その対象は外します"}。では、何を対象にしましょうか`, true); } // forbids G5-a (cycle0423): 発話で約束した除外をセッション禁止にも記録する (correction_without_base では記録しない)
    else if (reason === "gather_target_is_entity") say(p, bot, `${o.target?.name || "その生き物"}そのものは集められません。欲しい品物の名前で教えてください`, true); // 0-C4 R-C4-3 (cyc2373)
    else if (reason === "correction_without_base") say(p, bot, `${nm ? forbidTargetName(nm) + "ではない、ですね" : "訂正ですね"}。${o.retainedCandidates?.[0]?.name ? `${o.retainedCandidates[0].name}でよろしいですか` : "正しい対象を教えてください"}`, true);
    else if (reason === "chainmail_not_craftable") say(p, bot, "鎖の防具は作れません。作業台にレシピがありません。別の素材で、部位と一緒に言ってください", true); // 0-F R-5 (cyc2392)
    else if (reason === "netherite_upgrade_only") say(p, bot, "ネザライト防具は、直接は作れません。ダイヤ防具を鍛冶で強化する形です。ダイヤの部位で言ってください", true); // 0-F R-5 (cyc2392)
    else if (reason === "armor_part_without_material") say(p, bot, "どの素材か分かりません。ダイヤや鉄など、素材と部位を一緒に言ってください", true); // 0-F R-5 (cyc2392)
    else say(p, bot, "何を指しているか分かりませんでした。名前で教えてください", true);
    return;
  }

  if (o.kind === "free") { dps(bot, "cb_mode", "free"); say(p, bot, "おまかせ、了解です。状況は私が見ます", true); return; }
  if (o.kind === "escort") { dps(bot, "cb_mode", "follow"); say(p, bot, "分かりました。そばを離れません", true); return; }
  if (o.kind === "watch") { applyChatAct(p, bot, r, "stay_anchor"); say(p, bot, "分かりました。ここで見張ります。敵が近づけば対応します", true); return; }
  if (o.kind === "build") {
    // 0-C4 R-C4-2 (cyc2376): 設置位置は受理した同一呼び出しの中で、発話時点のスナップショット
    // (発話者セル・次元・向き) に対して解決して凍結し、既存の startBuild/tickBuild へ渡す。
    // tick を跨いだ解決はしない (所有者が移動した後の現在位置では解決しない)。
    let placementSnap = null;
    if (o.placement && o.target) {
      try {
        const yaw = Number(p.getRotation?.().y);
        let viewDir = null;
        if (Number.isFinite(yaw)) { const rad = yaw * Math.PI / 180; const vx = -Math.sin(rad), vz = Math.cos(rad); viewDir = Math.abs(vx) >= Math.abs(vz) ? { x: Math.sign(vx), z: 0 } : { x: 0, z: Math.sign(vz) }; }
        placementSnap = { ownerPos: { x: Math.floor(p.location.x), y: Math.floor(p.location.y), z: Math.floor(p.location.z) }, dim: (() => { try { return p.dimension?.id ?? null; } catch { return null; } })(), viewDir };
        r.pendingPlacement = { target: o.target?.block || o.target?.item || null, name: o.target?.name || null, placement: o.placement, at: Date.now(), ownerPos: placementSnap.ownerPos, dim: placementSnap.dim, viewDir: placementSnap.viewDir };
      } catch {}
    }
    const nm = o.target?.name || "";
    const bp = BLUEPRINTS.find((b) => nm && (b.name.includes(nm) || nm.includes(b.name) || b.id === nm));
    if (o.placement && o.target?.block && placementSnap) {
      if (bp && o.placement.mode === "relative") { // 設計 §4 Step 4: 図面原点の相対指定は未定義。黙って発話者位置に建てない
        try { r.pendingPlacement = null; } catch {}
        say(p, bot, "設置場所つきの建築は、まだできません。場所なしで頼んでください", true); return;
      }
      if (!bp) {
        if (r.mission && r.mission.status === "active") { say(p, bot, "今の指示の途中です。やめるなら「やめて」と言ってください", true); return; }
        const itemId = placementItemIdOf(o.target);
        const anchorExpected = !!(o.placement.anchor && (o.placement.anchor.block || o.placement.anchor.item));
        let anchorCell = null;
        if (anchorExpected) { try { anchorCell = scanBlockNear(bot, r, placementItemIdOf(o.placement.anchor)); } catch {} }
        const res = resolvePlacement({ placement: o.placement, ownerPos: placementSnap.ownerPos, viewDir: placementSnap.viewDir, anchorCell, anchorExpected });
        try { r.pendingPlacement = null; } catch {} // 設置分岐に入ったら成功・失敗を問わず消費する (残留を仕様にしない)
        if (!res.ok) {
          if (res.reason === "anchor_not_found") say(p, bot, `${o.placement.anchor?.name || "設置先"}が、近くに見つかりません`, true);
          else say(p, bot, "設置する場所が決められませんでした。場所を変えて、もう一度どうぞ", true);
          return;
        }
        let occ = null; try { occ = (p.dimension || bot.dimension).getBlock(res.cell); } catch {}
        if (occ && occ.typeId && occ.typeId !== "minecraft:air") { say(p, bot, "そこには、もう別のものがあります。置けませんでした", true); return; }
        const amount = Math.max(1, Math.floor(o.amount ?? 1));
        const relCells = amount > 1 ? linkedPlacementCells(amount, placementSnap.viewDir) : [{ dx: 0, dy: 0, dz: 0 }];
        const cells = relCells.map((c) => ({ ...c, item: itemId }));
        if (amount > 1) say(p, bot, `${nm}を${amount}個、置きます`, true);
        startBuild(bot, p, r, nm || "設置", cells, res.cell, true);
        return;
      }
    }
    if (!bp) {
      // v0.4.67: 図面が無くても、クラフトで作れる物 (道具・かまど・インゴット等) なら長期タスクとして作る
      const mo0 = parserOrderToMission(o);
      // 0-F2 (cyc2003): 防具一式は4部位すべて作製可能か先に検証し、最初の部位を開始して残りを
      // pendingGearSet へ保持する (finishMission が完了ごとに次部位を開始する)。
      if (Array.isArray(o.gearSet) && o.gearSet.length > 1) {
        // 0-F R-7b U7-3 (cyc2398): セット数ぶん部位列を展開し、既存 pendingGearSet へ流す
        // (sets=1 では従来と完全一致)。検証はセット数ぶんの amount で行う。
        const gearSetsN = Math.max(1, Math.floor(o.amount ?? 1));
        const gearSeq = [];
        for (let i = 0; i < gearSetsN; i++) for (const gid of o.gearSet) gearSeq.push(gid);
        let allOk = true;
        for (const gid of o.gearSet) { let ok = false; try { const pl = planLongTask({ target: "minecraft:" + gid, amount: gearSetsN }, countInv(bot), invDurabilityOf(bot)); ok = !!(pl && pl.feasible); } catch {} if (!ok) { allOk = false; break; } }
        if (!allOk) { say(p, bot, `${o.gearMaterial || ""}の一式は、今の調達経路では作りきれません。部位ごとに頼んでください`, true); return; }
        if (r.mission && r.mission.status === "active") { say(p, bot, "今の指示の途中です。やめるなら「やめて」と言ってください", true); return; }
        r.pendingGearSet = gearSeq.slice(1).map((gid) => "minecraft:" + gid);
        savePendingGearSet(bot, r); // 0-F R-2 (cyc2379): 設定と同時に DP へ保存する
        mo0.amount = 1; mo0.target = "minecraft:" + gearSeq[0];
        startMission(bot, p, r, mo0);
        return;
      }
      let craftable = false;
      if (mo0.target) {
        mo0.amount = o.amount ?? 1;
        for (const t of [mo0.target, String(mo0.target).includes(":") ? null : "minecraft:" + mo0.target]) { if (!t || craftable) continue; try { const pl = planLongTask({ ...mo0, target: t }, countInv(bot), invDurabilityOf(bot)); if (pl && pl.feasible) { craftable = true; mo0.target = t; } } catch {} }
      }
      if (!craftable) { say(p, bot, "その建物は、まだ図面がありません。……小屋なら建てられます", true); return; }
      if (r.mission && r.mission.status === "active") { say(p, bot, "今の指示の途中です。やめるなら「やめて」と言ってください", true); return; }
      startMission(bot, p, r, mo0);
      return;
    }
    if (r.mission && r.mission.status === "active") { say(p, bot, "今の指示の途中です。やめるなら「やめて」と言ってください", true); return; }
    startBuild(bot, p, r, bp.name, buildOrderOf(bp.blocks), p.location, true);
    return;
  }
  const mo = parserOrderToMission(o);
  if (!mo.target) { say(p, bot, "対象が分かりませんでした。素材の名前を入れて、もう一度どうぞ", true); return; }
  if (r.mission && r.mission.status === "active") { say(p, bot, "今の指示の途中です。やめるなら「やめて」と言ってください", true); return; }
  // forbids G5-b (cycle0855): 混在注文の negations もセッション禁止へ記録する (単独 forbid・clarify 除外と統一する裁定)。
  // 肯定対象自身は parserOrderToMission と同じく除外する (自己禁止の防止)。記録は mission が実際に始まる直前でのみ行う。
  if ((o.negations || []).length) { try { recordSessionForbids(bot, r, { negations: (o.negations || []).filter((n) => { const nid = n?.target?.item || n?.target?.block || n?.target?.entity; return nid && nid !== mo.target; }) }); } catch {} }
  startMission(bot, p, r, mo);
}

function handleChatMessage(p, rawIn) {
  const raw = rawIn || "";
  const bot = findBotEntity(p.id); if (!bot) return;
  const r = rt(bot); const now = Date.now();
  r.lastChatAt = now;
  // POLISH-ANIM-HEED-01 (cycle1443): 主人の発言の辺で1回だけ聞き取り視線を記録する (表示層のみ・発話内容には触らない・実機確認待ち)
  try {
    if (!r.heedState) r.heedState = createHeedState();
    const bp = bot.location, op = p.location;
    const dist = bp && op ? Math.hypot(op.x - bp.x, op.y - bp.y, op.z - bp.z) : null;
    let relYaw = null;
    try { const cur = bot.getRotation?.().y; const want = Math.atan2(-(op.x - bp.x), op.z - bp.z) * 180 / Math.PI; if (typeof cur === "number" && Number.isFinite(cur)) relYaw = want - cur; } catch {}
    const fired = noteHeedState(r.heedState, { isOwner: true, addressed: true, distance: dist, relYawDeg: relYaw, sameDimension: bot.dimension?.id === p.dimension?.id, nowMs: now, hasWorkTarget: !!r.work, falling: r.selfFalling === true, flinchActive: isFlinchActive(r.flinchAnimAt, now) });
    if (fired) r.lastHeed = { at: now, relYawDeg: r.heedState.relYawDeg };
  } catch {}
  const msg = raw.toLowerCase();
  const conv = convOf(r);
  let und = null; try { und = understand(raw); } catch {}
  if (und?.features?.praise) r.lastPraiseAt = now;
  const ctx = r.lastCtx || buildContext(bot, p).ctx;

  // ① ミッション操作コマンド（調停より優先）
  if (r.mission && r.mission.status === "active") {
    if (gateCancel(raw).fire) { system.run(() => { cancelMission(bot, p, r); try { conv.hear(raw, "mission_cancel"); } catch {} }); return; }
    if (/進捗|どうなってる|状況は/.test(raw)) {
      const s = missionSummary(r.mission); const cs = s?.currentStep;
      system.run(() => { say(p, bot, `進捗です。${nameOfItem(s.target)}${cs ? ` ${cs.have}/${cs.need}` : ""}。段階は ${s.stepsDone}/${s.stepsTotal} まで進んでいます`, true); try { conv.hear(raw, "mission_status"); } catch {} });
      return;
    }
  }
  // ①.4 E-02: 仕事が無く条件保留だけがある状態でも、中止発話で保留を取り下げられる出口
  if (!r.mission && r.pendingConditionOrder && gateCancel(raw).fire) {
    clearPendingCondition(bot, r);
    system.run(() => { say(p, bot, "分かりました。条件の指示は取り下げました", true); try { conv.hear(raw, "pending_condition_cancel"); } catch {} });
    return;
  }
  // 0-F3 (cyc2003): ネザーゲート/ポータルの建築は未対応。知識説明へ流して受理したように見せず、
  // できない部分 (フレーム設置・点火・次元移動) をその場で明示する (0-C7 原則)。質問形は対象外。
  if (/(ネザーゲート|ネザーポータル|ポータル)/.test(raw) && /(作って|作る|建てて|建てる|設置)/.test(raw) && !/(教えて|方法|どう|？|\?)/.test(raw)) {
    system.run(() => { say(p, bot, "ネザーゲートは、まだ作れません。黒曜石の枠の設置も、火打ち石での点火も、次元を移動する仕組み自体も未実装です。枠だけでも先に置く形は、今後の課題に記録しました", true); try { conv.hear(raw, "portal_unsupported"); } catch {} });
    return;
  }
  // 0-F3 点火単独形 (cyc2059): 枠が既にある前提の点火依頼も、知識説明へ流さず未対応を明示する。
  // 質問形・否定形では発火しない (0-C1 ゲートと同作法)。点火が正式版 API で可能かは断定しない。
  if (/(ネザーゲート|ネザーポータル|ポータル|ゲート)/.test(raw) && /(点火|着火|再点火|火をつけ|火を付け|火を点け)/.test(raw) && !/(教えて|方法|どう|？|\?)/.test(raw) && !/(しないで|しない|するな)/.test(raw)) {
    system.run(() => { say(p, bot, "点火は、まだできません。火打ち石で火をつける仕組みが未実装です。枠が既にある場合も、点火だけを代行することはできません", true); try { conv.hear(raw, "portal_ignite_unsupported"); } catch {} });
    return;
  }
  // 0-L/0-M (cyc2232 A18): ブランチマイニング・露天掘りは持続採掘として未実装。知識説明へ流して受理したように見せず、できないことを明示する (0-C7 最低ライン)。質問形・否定形では発火しない。
  if (/(ブランチマイニング|ブラマイ|魚骨掘り)/.test(raw) && /(して|をして|やって|開始|頼む|お願い)/.test(raw) && !/(教えて|方法|どう|？|\?)/.test(raw) && !/(しないで|しない|するな)/.test(raw)) {
    system.run(() => { say(p, bot, "ブランチマイニングは、まだできません。持続的に掘り続ける採掘と、満杯時の保管・再開の仕組みが未実装です。個別の鉱石なら、個数を言えば集めます", true); try { conv.hear(raw, "branch_mining_unsupported"); } catch {} });
    return;
  }
  if (/(露天掘り)/.test(raw) && /(して|をして|やって|開始|頼む|お願い)/.test(raw) && !/(教えて|方法|どう|？|\?)/.test(raw) && !/(しないで|しない|するな)/.test(raw)) {
    system.run(() => { say(p, bot, "露天掘りは、まだできません。範囲を層ごとに掘り下げる持続採掘が未実装です。個別の鉱石なら、個数を言えば集めます", true); try { conv.hear(raw, "open_pit_unsupported"); } catch {} });
    return;
  }
  // ①.44 倉庫 W3-TEACH (cyc2355): 「<素材>はこっちに入れて」で行き先を学習する書き手。
  // 読み手 (adapter→sort 判定順1) と永続化 (cb_warehouse 単一保存点) は既存。ゲートが止めた場合は通常解釈へ流す。
  // 失敗は受理したように見せず明示返答する (0-C7 原則)。成功時のみ台帳差し替え+saveWarehouse 1回。
  {
    const gt = gateTeachItemDest(raw);
    if (gt.fire) {
      const itemId = resolveItem(gt.itemName);
      if (!itemId) { system.run(() => { say(p, bot, `${gt.itemName}は、分かりませんでした。素材の名前を、もう少し正確にどうぞ`, true); try { conv.hear(raw, "warehouse_teach_unknown_item"); } catch {} }); return; }
      let key = null;
      try { const vb = p.getBlockFromViewDirection({ maxDistance: 10 }); if (vb && isContainerBlock(vb.block.typeId)) key = warehouseKeyOf(p.dimension.id, vb.block.location.x, vb.block.location.y, vb.block.location.z); } catch {}
      if (!key) { system.run(() => { say(p, bot, "どの箱か分かりませんでした。入れたい箱を見ながら、もう一度どうぞ", true); try { conv.hear(raw, "warehouse_teach_no_box"); } catch {} }); return; }
      if (!r.warehouse) r.warehouse = createWarehouseRegistry();
      const out = teachItemDest(r.warehouse, itemId, key);
      if (out.ok) { r.warehouse = out.reg; saveWarehouse(bot, r); system.run(() => { say(p, bot, `${gt.itemName}は、その箱に入れるように覚えました`, true); try { conv.hear(raw, "warehouse_teach"); } catch {} }); }
      else if (out.reason === "excluded_priority") { system.run(() => { say(p, bot, "その箱は除外に設定されているため、行き先にはできませんでした", true); try { conv.hear(raw, "warehouse_teach_excluded"); } catch {} }); }
      else { system.run(() => { say(p, bot, "その箱は、まだ登録されていません。先にリモコンの倉庫メニューで登録してください", true); try { conv.hear(raw, "warehouse_teach_unregistered"); } catch {} }); }
      return;
    }
  }
  // ①.45 倉庫 W2 (cyc1939): 整理の依頼は注文パーサーへ流さず倉庫整理へ直結する
  // cyc2330 0-C1 G6: 判定は chat_gate の gateWarehouseSort へ一本化 (否定・熟慮・条件・質問形では発火しない)
  if (gateWarehouseSort(raw).fire) {
    system.run(() => { runWarehouseSort(p, bot, r); try { conv.hear(raw, "warehouse_sort"); } catch {} });
    return;
  }
  // ①.5 Phase5 clarify 再開フック: 保持中の聞き返しへの回答を、提案収集より前に解釈する（深さ1）
  try {
    const pc = conv && conv.getPendingClarify ? conv.getPendingClarify() : null;
    if (pc) {
      const res = resumeClarifyOrder(pc, und?.normalized || raw);
      if (res.action === "cancelled") {
        conv.clearPendingClarify("cancelled");
        system.run(() => { say(p, bot, "分かりました。なかったことにします", true); try { conv.hear(raw, "clarify_cancel"); } catch {} });
        return;
      }
      if (res.action === "order" && res.order && res.order.kind !== "clarify") {
        conv.clearPendingClarify(res.reason || "answered");
        const ord = res.order;
        system.run(() => { startOrderFromParser(p, bot, r, ord); try { conv.hear(raw, "clarify_resume"); } catch {} });
        return;
      }
      // cycle1640: 限定破棄。質問・社交・長文などの挟み言葉では保持を残し (strikes はリセット)、回答試行の外れが2回連続した時だけ破棄する (TTL 90秒が出口)
      const cls = classifyClarifyUnmatched(pc, und?.normalized || raw, und, pc.unmatchedStrikes || 0);
      if (cls === "discard") conv.clearPendingClarify("unmatched_answer");
      else if (cls === "strike") { try { pc.unmatchedStrikes = (pc.unmatchedStrikes || 0) + 1; } catch {} }
      else { try { pc.unmatchedStrikes = 0; } catch {} }
    }
  } catch {}

  // ② 工場自動化リクエスト
  if (tryFactoryRequest(p, bot, r, raw)) { try { conv.hear(raw, "factory"); } catch {} return; }

  // ③ 提案収集
  const proposals = [];
  let parsed = null; try { parsed = parseOrder(und?.normalized || raw); } catch {}
  // 0-C7 (cycle1337): 未対応の依頼は知識・計算・別作業へ流さず、その場で「できないこと」を返す (調停より前)
  const uns = (() => { try { return detectUnsupportedIntent(raw, { parsedKind: parsed?.kind ?? null, hasTarget: !!parsed?.target }); } catch { return null; } })();
  if (uns) { system.run(() => { say(p, bot, uns.reply, true); try { conv.hear(raw, "unsupported_" + uns.kind); } catch {} }); return; }
  const ordProp = isHowToRequest(raw) ? null : adaptOrder(parsed); if (ordProp) proposals.push(ordProp);
  let latest = null; try { latest = detectLatestTopic(raw); } catch {}
  if (latest) {
    let line = null; try { line = pickHonestyLine(latest, r.usedHonesty || []); } catch {}
    if (line) { r.usedHonesty = [...(r.usedHonesty || []), line].slice(-8); proposals.push({ source: "qa", text: line, confidence: 0.85, category: "latest_topic" }); }
  }
  let qaAns = null; try { qaAns = answerQuestion(raw, ctx); } catch {}
  const qaProp = adaptQA(qaAns); if (qaProp) proposals.push(qaProp);
  let toolRes = null; try { toolRes = tryTool(raw, ctx); } catch {}
  const toolProp = adaptTool(toolRes); if (toolProp) proposals.push(toolProp);
  let mathRes = null; try { mathRes = tryMath(raw); } catch {}
  if (mathRes?.text) proposals.push({ source: "tool", text: mathRes.text, confidence: 0.9, category: mathRes.category || "math" });
  let know = null; try { know = lookupAll(raw); } catch {}
  const knowProp = adaptKnowledge(know?.entry, raw); if (knowProp) proposals.push(knowProp);
  try { const ref = conv.resolveReference(raw); if (ref && ref.kind === "count" && ref.target) proposals.push({ source: "followup", text: `${ref.target.name}は、今${ref.target.count}個目です`, confidence: 0.8, category: "ref_count" }); } catch {}
  const fu = matchCat(FOLLOWUPS, msg, true, r, conv);
  if (fu) { const prop = adaptFollowup(fu.cat, { text: pick(fu.cat.replies || []), keyLen: fu.keyLen }); if (prop) proposals.push(prop); }
  const lore = matchCat(CHAT_LORE, msg, false, r, conv);
  if (lore) {
    const bond = dp(bot, "cb_bond", 30);
    const replies = bond >= (lore.cat.deepMinBond ?? LORE_DEEP_MIN_BOND) ? (lore.cat.deep || lore.cat.replies) : (lore.cat.shallow || lore.cat.replies);
    const prop = adaptChat(lore.cat, { text: pick(replies || []), keyLen: lore.keyLen }); if (prop) proposals.push(prop);
  }
  const chat = matchCat(CHAT_ALL, msg, false, r, conv);
  if (chat) { const prop = adaptChat(chat.cat, { text: pick(chat.cat.replies || []), keyLen: chat.keyLen }); if (prop) proposals.push(prop); }

  let winner = null; try { winner = arbitrate(proposals.filter(Boolean), conv.getContext()); } catch {}
  system.run(() => {
    if (!winner) {
      r.fallbackStreak = (r.fallbackStreak || 0) + 1;
      let fb = null;
      try { fb = composeFallback({ danger: ctx.danger, mode: dp(bot, "cb_mode", "follow"), mission: !!(r.mission && r.mission.status === "active"), env: ctx.env?.isNight ? "night" : undefined, flags: ctx.flags, openQuestion: /[？?]/.test(raw), history: [] }, r.fallbackStreak - 1); } catch {}
      if (fb) say(p, bot, fb, true);
      try { conv.hear(raw, null); } catch {}
      return;
    }
    r.fallbackStreak = 0;
    if (winner.source === "order" && winner.order) {
      startOrderFromParser(p, bot, r, winner.order);
      try { conv.hear(raw, winner.category); conv.noteBot(winner.category); } catch {}
      r.lastTopic = winner.category; r.lastTopicAt = Date.now();
      return;
    }
    if (winner.text) say(p, bot, winner.text, true);
    applyChatAct(p, bot, r, winner.act);
    try { conv.hear(raw, winner.category); conv.noteBot(winner.category, winner.category); } catch {}
    r.lastTopic = winner.category; r.lastTopicAt = Date.now();
  });
}
// v0.4.57: chatSend は正式版 API 2.x で undefined の可能性が v0.4.44 の実機ログで示された
// (TypeError: cannot read property 'subscribe' of undefined)。存在する時だけ購読し、起動時に型を
// コンテンツログへ1行出す (これで白黒がつく)。無い環境ではメニューの「文字で指示する」が受け口になる。
console.warn(`[LIZE] chatSend after: ${typeof world.afterEvents.chatSend} / before: ${typeof world.beforeEvents?.chatSend}`);
try { if (world.afterEvents.chatSend) world.afterEvents.chatSend.subscribe((ev) => { handleChatMessage(ev.sender, ev.message || ""); }); } catch (err) { console.warn(`[LIZE] chatSend subscribe failed: ${err}`); }
// v0.4.58: 実機確定 (2026-11-24 TANAKA のログ): chatSend は after/before ともに正式版では undefined (Beta 専用)。
// 正式版で使える文字入力としてカスタムコマンド /lize を startup で登録する (成否はコンテンツログで確定させる)。
// 文字列パラメータは1トークンずつしか取れないため、任意パラメータを連結して文章にする。
try {
  const CPL = mcServer.CommandPermissionLevel, CPT = mcServer.CustomCommandParamType, CCS = mcServer.CustomCommandStatus;
  if (!CPL || !CPT || !CCS || !system.beforeEvents?.startup) {
    console.warn("[LIZE] custom command API unavailable in this environment");
  } else {
    system.beforeEvents.startup.subscribe((ev) => {
      try {
        const opt = []; for (let i = 2; i <= 8; i++) opt.push({ name: `text${i}`, type: CPT.String }); // 引数は合計 8 個まで (必須 1 + 任意 7)。超えると登録エラー
        ev.customCommandRegistry.registerCommand({
          name: "companion_bot:lize", // 名前空間が必須 (無いと NamespaceNameError)。他と重ならなければ /lize でも呼べる
          description: "リゼに文字で指示・会話する (例: /lize 鉄を 10個 集めて)",
          permissionLevel: CPL.Any,
          mandatoryParameters: [{ name: "text1", type: CPT.String }],
          optionalParameters: opt,
        }, (origin, ...args) => {
          const src = origin?.sourceEntity;
          if (!src || src.typeId !== "minecraft:player") return { status: CCS.Failure, message: "プレイヤーからのみ使えます" };
          const text = args.filter((a) => typeof a === "string").join(" ").trim();
          if (text) system.run(() => handleChatMessage(src, text));
          return { status: CCS.Success };
        });
        console.warn("[LIZE] custom command /lize registered");
      } catch (err) { console.warn(`[LIZE] custom command register failed: ${err}`); }
    });
  }
} catch (err) { console.warn(`[LIZE] startup subscribe failed: ${err}`); }
