import {expect,test} from 'vitest';
import {chooseArchive, createMapStyle} from '../src/lib/map-style';
test('Yongin uses downloaded 수도권 archive; regional centers select correct archive',()=>{expect(chooseArchive([127.3,37.23])).toBe('seoul-metro');expect(chooseArchive([128.9,37.75])).toBe('gangwon');expect(chooseArchive([127.38,36.35])).toBe('chungcheong');expect(chooseArchive([130.8,37.5])).toBeNull();});
test('static map makes no requests to external tile APIs',()=>{const s=createMapStyle('seoul-metro','http://localhost:3000','/app');expect(JSON.stringify(s.sources)).toContain('http://localhost:3000/app/maps/seoul-metro.pmtiles');expect(Object.values(s.sources).filter(x=>x.type==='vector').every(x=>x.url?.startsWith('pmtiles://http://localhost:3000/app/maps/'))).toBe(true);});
