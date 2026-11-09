import { describe, expect, test } from 'vitest';
import { evaluateClearance, heightInfo, searchPlaces, parseCoordinates, type SearchPlace } from '../src/lib/domain';
describe('source confidence', () => {
 test('unknown map heights are only display assumptions', () => { expect(heightInfo({})).toEqual({height:null,displayHeight:6,basis:'unknown'}); });
 test('source heights are not surveys and reject invalid values', () => { expect(heightInfo({height:15}).basis).toBe('map'); expect(heightInfo({height:-1}).height).toBeNull(); expect(heightInfo({height:'30'}).height).toBeNull(); });
 test('missing or zero clearance never passes', () => { expect(evaluateClearance(null,4,null)).toBe('unknown'); expect(evaluateClearance(5,4,null)).toBe('unknown'); expect(evaluateClearance(0,4,0)).toBe('unknown'); });
 test('confirmed failure dominates unknown values', () => { expect(evaluateClearance(3.8,4,null)).toBe('fail'); expect(evaluateClearance(4.3,4,0.4)).toBe('fail'); expect(evaluateClearance(4.5,4,0.5)).toBe('pass'); });
});
describe('geographic search', () => {
 const places:SearchPlace[]=[{name:'남평로',region:'경기',kind:'road',center:[127.298,37.229]},{name:'강남대로',region:'서울',kind:'road',center:[127.03,37.5]}];
 test('road vicinity is never an exact house-number match', () => { const r=searchPlaces('경기도 용인시 처인구 양지읍 남평로 111-73',places); expect(r).toHaveLength(1); expect(r[0].confidence).toBe('vicinity'); });
 test('unknown address gives no false result', () => { expect(searchPlaces('없는도로999',places)).toEqual([]); });
 test('coordinates require explicit lng,lat in regional bounds', () => { expect(parseCoordinates('127.3,37.23')).toEqual([127.3,37.23]); expect(parseCoordinates('37.23,127.3')).toBeNull(); expect(parseCoordinates('0,0')).toBeNull(); });
});
