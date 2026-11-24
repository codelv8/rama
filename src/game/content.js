/** Original RAMA campaign content. All durations are seconds; rates are per minute. */
export const RESOURCE_NAMES = Object.freeze({ wood: 'ไม้', stone: 'ศิลา', bronze: 'สำริด', rice: 'ข้าว' });
export const RESOURCE_IDS = Object.freeze(Object.keys(RESOURCE_NAMES));

export const BUILDINGS = [
  { id: 'palace', name: 'พระราชวัง', subtitle: 'หัวใจแห่งอโยธยา', description: 'ขยายอาณาจักร เพิ่มความจุคลัง และปลดล็อกสิ่งก่อสร้างระดับสูง', icon: 'crown', baseCost: { wood: 220, stone: 210, bronze: 85, rice: 80 }, duration: 22, maxLevel: 6 },
  { id: 'sawmill', name: 'โรงเลื่อย', subtitle: 'จากผืนป่าสู่เมืองใหญ่', description: 'ผลิตไม้สำหรับก่อสร้างและฝึกกองทัพ อัปเกรดเพื่อเพิ่มผลผลิตต่อเนื่อง', icon: 'trees', resource: 'wood', baseCost: { wood: 75, stone: 55, bronze: 10, rice: 25 }, duration: 12, maxLevel: 6 },
  { id: 'quarry', name: 'เหมืองศิลา', subtitle: 'รากฐานที่แข็งแกร่ง', description: 'ผลิตศิลาสำหรับพระราชวัง กำแพง และสิ่งก่อสร้างในอาณาจักร', icon: 'mountain', resource: 'stone', baseCost: { wood: 85, stone: 55, bronze: 15, rice: 20 }, duration: 14, maxLevel: 6 },
  { id: 'foundry', name: 'โรงหล่อสำริด', subtitle: 'อาวุธแห่งผู้พิทักษ์', description: 'ผลิตสำริดสำหรับเครื่องมือ อาวุธ และทหารระดับสูง', icon: 'flame', resource: 'bronze', baseCost: { wood: 100, stone: 90, bronze: 25, rice: 25 }, duration: 16, maxLevel: 6 },
  { id: 'farm', name: 'นาข้าว', subtitle: 'เลี้ยงเมือง เลี้ยงกองทัพ', description: 'ผลิตข้าวสำหรับฝึกทหารและเสบียงเดินทัพ ทุกการเดินทางเริ่มต้นที่นี่', icon: 'wheat', resource: 'rice', baseCost: { wood: 65, stone: 35, bronze: 5, rice: 35 }, duration: 12, maxLevel: 6 },
  { id: 'barracks', name: 'ค่ายทหาร', subtitle: 'รวมพลผู้กล้า', description: 'ฝึกพลพิทักษ์ พลธนู และทหารวานร ค่ายระดับ 2 ปลดล็อกวานรศึก', icon: 'swords', baseCost: { wood: 120, stone: 100, bronze: 45, rice: 70 }, duration: 18, maxLevel: 6 },
  { id: 'wall', name: 'ประตูนคร', subtitle: 'ปราการแห่งอโยธยา', description: 'เพิ่มขวัญกำลังใจและลดการสูญเสียของทหารในการออกศึก', icon: 'shield', baseCost: { wood: 90, stone: 130, bronze: 35, rice: 25 }, duration: 16, maxLevel: 6 },
  { id: 'market', name: 'ตลาดชุมชน', subtitle: 'เส้นเลือดของเมือง', description: 'เพิ่มความจุทรัพยากรทุกชนิด และเพิ่มผลผลิตทั้งอาณาจักร', icon: 'store', baseCost: { wood: 110, stone: 65, bronze: 30, rice: 65 }, duration: 15, maxLevel: 6 },
  { id: 'shrine', name: 'เทวสถาน', subtitle: 'พรแห่งหิมพานต์', description: 'เพิ่มพลังวีรชนและลดการสูญเสียของกองทัพในการเดินทาง', icon: 'sparkles', baseCost: { wood: 90, stone: 120, bronze: 60, rice: 70 }, duration: 20, maxLevel: 6 },
];

export const TROOPS = [
  { id: 'guardian', name: 'พลพิทักษ์', title: 'แนวหน้าผู้กล้า', description: 'ทหารราบที่ฝึกได้รวดเร็ว เป็นกำลังหลักของอาณาจักร', icon: 'shield', attack: 12, defense: 14, baseCost: { wood: 16, stone: 0, bronze: 7, rice: 20 }, trainingSeconds: 5, unlockBarracks: 1 },
  { id: 'archer', name: 'พลธนู', title: 'ศรแห่งอโยธยา', description: 'กองหนุนระยะไกลที่สร้างพลังโจมตีสูง ใช้ไม้ในการฝึกมากขึ้น', icon: 'bow', attack: 18, defense: 8, baseCost: { wood: 24, stone: 0, bronze: 9, rice: 22 }, trainingSeconds: 6, unlockBarracks: 1 },
  { id: 'vanara', name: 'วานรศึก', title: 'นักรบแห่งพงไพร', description: 'หน่วยชั้นสูงที่มีพลังและความคล่องตัว ต้องมีค่ายทหารระดับ 2', icon: 'zap', attack: 32, defense: 20, baseCost: { wood: 25, stone: 10, bronze: 22, rice: 35 }, trainingSeconds: 7, unlockBarracks: 2 },
];

export const HEROES = [
  { id: 'rama', name: 'พระราม', title: 'ผู้พิทักษ์แห่งอโยธยา', description: 'ผู้นำผู้ถือคันศร สะสมประสบการณ์จากการศึกเพื่อพัฒนาโจมตี ป้องกัน และโชคลาภ', faction: 'อโยธยา', available: true },
  { id: 'hanuman', name: 'หนุมาน', title: 'ทหารเอกแห่งวานร', description: 'สหายแห่งตำนาน ภาพประกอบวีรชนสำหรับอาณาจักร', faction: 'ขีดขิน', available: false },
  { id: 'thotsakan', name: 'ทศกัณฐ์', title: 'จอมราชาแห่งลงกา', description: 'คู่ปรับในแคมเปญหิมพานต์ นำทัพผ่านด่านเพื่อไปถึงนครลงกา', faction: 'ลงกา', available: false },
];

export const QUESTS = [
  { id: 'foundation', title: 'รากฐานอาณาจักร', description: 'อัปเกรดสิ่งก่อสร้างสำเร็จ 1 ครั้ง', metric: 'upgrades', target: 1, reward: { wood: 150, stone: 120, bronze: 40, rice: 150 }, xp: 25 },
  { id: 'recruit', title: 'รวบรวมผู้กล้า', description: 'ฝึกทหารสำเร็จรวม 6 นาย', metric: 'trained', target: 6, reward: { wood: 180, stone: 120, bronze: 90, rice: 250 }, xp: 30 },
  { id: 'first-victory', title: 'ก้าวแรกสู่หิมพานต์', description: 'ออกสำรวจและชนะการศึก 1 ครั้ง', metric: 'victories', target: 1, reward: { wood: 220, stone: 180, bronze: 110, rice: 280 }, xp: 45 },
  { id: 'growth', title: 'นครที่รุ่งเรือง', description: 'พัฒนาพระราชวังถึงระดับ 3', metric: 'palace', target: 3, reward: { wood: 350, stone: 350, bronze: 180, rice: 400 }, xp: 60 },
  { id: 'campaign', title: 'เส้นทางผู้พิทักษ์', description: 'พิชิตพื้นที่บนแผนที่โลก 3 แห่ง', metric: 'completedNodes', target: 3, reward: { wood: 500, stone: 450, bronze: 260, rice: 600 }, xp: 80 },
  { id: 'liberation', title: 'ตำนานบทใหม่', description: 'พิชิตนครลงกาและจบแคมเปญ', metric: 'lanka', target: 1, reward: { wood: 1000, stone: 1000, bronze: 700, rice: 1200 }, xp: 150 },
];

export const WORLD_NODES = [
  { id: 'grove', name: 'ป่าหิมพานต์', subtitle: 'เสียงเรียกจากพงไพร', description: 'เปิดเส้นทางป่าและนำทรัพยากรกลับสู่เมือง เหมาะกับกองทัพเริ่มต้น', kind: 'forest', x: 25, y: 64, threat: 150, duration: 25, minPalace: 1, reward: { wood: 240, stone: 80, bronze: 25, rice: 180 }, xp: 35 },
  { id: 'river', name: 'ท่าน้ำสุพรรณ', subtitle: 'เส้นทางแห่งสายน้ำ', description: 'ปกป้องท่าน้ำเพื่อเปิดเส้นทางเสบียงของอโยธยา', kind: 'river', x: 43, y: 75, threat: 240, duration: 30, minPalace: 2, reward: { wood: 180, stone: 200, bronze: 60, rice: 320 }, xp: 45 },
  { id: 'outpost', name: 'ค่ายอสูร', subtitle: 'เงามืดที่ชายแดน', description: 'ทัพอสูรตั้งมั่นอยู่ที่ชายแดน เตรียมกำลังเสริมก่อนเข้าปะทะ', kind: 'camp', x: 55, y: 48, threat: 350, duration: 35, minPalace: 2, reward: { wood: 260, stone: 300, bronze: 180, rice: 350 }, xp: 55 },
  { id: 'valley', name: 'หุบเขาวานร', subtitle: 'พันธมิตรในขุนเขา', description: 'ผ่านแนวหุบเขาและช่วยปลดปล่อยเส้นทางของเหล่าวานร', kind: 'mountain', x: 35, y: 29, threat: 520, duration: 40, minPalace: 3, reward: { wood: 400, stone: 450, bronze: 260, rice: 500 }, xp: 70 },
  { id: 'fortress', name: 'ป้อมมหาอสูร', subtitle: 'ปราการสุดท้าย', description: 'ป้อมหน้าด่านแห่งลงกา ต้องใช้กองทัพที่เติบโตและวีรชนที่พร้อมรบ', kind: 'fortress', x: 72, y: 31, threat: 750, duration: 45, minPalace: 3, reward: { wood: 550, stone: 600, bronze: 400, rice: 650 }, xp: 90 },
  { id: 'lanka', name: 'นครลงกา', subtitle: 'บทสุดท้ายของตำนาน', description: 'นำทัพสู่ชัยชนะครั้งสุดท้ายเพื่อคืนความสงบให้แผ่นดิน', kind: 'citadel', x: 79, y: 62, threat: 1100, duration: 60, minPalace: 3, reward: { wood: 900, stone: 900, bronze: 650, rice: 1000 }, xp: 140 },
];
