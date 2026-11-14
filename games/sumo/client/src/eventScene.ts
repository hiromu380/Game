/**
 * 出来事の窓の挿絵: 話に合う部屋の中の絵（純粋関数）。出来事は種類ごとの部屋、話の中身で合う部屋があればそちら
 */
import type { RoomId } from './art/hakoniwa/actors';

export type EventPicture = RoomId | 'keikoba';

/** 種類ごとの部屋（balance/happenings.ts の並び） */
const BY_ID: Record<string, EventPicture> = {};
const put = (pic: EventPicture, ids: readonly string[]) => ids.forEach((id) => (BY_ID[id] = pic));
// 後援会・タニマチ → 応接間（来客）
put('room_ousetsu', [
  'supporterParty',
  'tanimachiDinner',
  'newSponsor',
  'sponsorScandal',
  'kenshoOffer',
  'merchandise',
]);
put('room_genkan', ['hometownCheer']);
// 稽古・成長 → 稽古場
put('keikoba', [
  'demegeiko',
  'rengoKeiko',
  'soken',
  'kneeWorry',
  'guestCoach',
  'bulkUp',
  'lateStudy',
  'strictSenior',
  'summerCamp',
  'rivalDemegeiko',
  'rivalTaunt',
]);
// 暑さ寒さ・弟子の暮らし → 大部屋
put('room_oobeya', [
  'heatWave',
  'coldSnap',
  'homesick',
  'runaway',
  'snsTrouble',
  'drinkingTrouble',
  'japaneseClass',
  'quarrel',
  'veteranDoubt',
  'leakyRoof',
]);
// 食べ物 → 厨房
put('room_kitchen', ['riceGift', 'chankoVideo', 'newChanko', 'nutritionist']);
// 身内の来訪 → 応接間・居間
put('room_ousetsu', ['parentsVisit', 'wedding']);
put('room_ima', ['alumniVisit', 'lodging']);
// 経営・協会・取材・スカウト → 玄関と事務室
put('room_genkan', [
  'managerQuits',
  'taxAudit',
  'ichimonMeeting',
  'associationDuty',
  'tvInterview',
  'overseasEvent',
  'promisingKid',
  'collegeStar',
  'highSchoolCoach',
  'overseasProspect',
]);
// 体の手入れ・医療 → 治療室
put('room_clinic', ['chiropractor', 'famousDoctor', 'surgery', 'hospitalVisit', 'kneeWorry']);
// 体づくり → トレーニング室
put('room_gym', ['bulkUp']);
// 地域・行事 → 中庭
put('room_niwa', ['kidsSumo', 'disasterRelief', 'newYearVisit', 'setsubun']);

export function happeningPicture(id: string): EventPicture | null {
  return BY_ID[id] ?? null;
}

/** 出来事以外の窓（引退・治療・選挙・独立・入門希望者） */
export const OTHER_PICTURE = {
  retire: 'room_ima',
  treatment: 'room_clinic',
  election: 'room_genkan',
  independence: 'room_ima',
  candidate: 'room_genkan',
} as const satisfies Record<string, EventPicture>;
