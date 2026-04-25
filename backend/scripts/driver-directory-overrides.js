export const DRIVER_DIRECTORY_OVERRIDES = [
  { matchFirst: 'Yosbeny', matchLast: 'Torres Mesa', username: 'yosbeny', phone: '407-942-4107' },
  { matchFirst: 'Yanelis', matchLast: 'Hernandez', username: 'Yanelis', phone: '407-353-1135' },
  { matchFirst: 'Yiseker', matchLast: 'Dieguez', username: 'vivi', phone: '321-246-9230', previousLogin: 'Yiseker' },
  { matchFirst: 'Yordanis', matchLast: 'Roman Torres', username: 'Roman', phone: '432-766-4511', previousLogin: 'Yordanis' },
  { matchFirst: 'Orlando', matchLast: 'Landeiro Valle', username: 'Orlando', phone: '407-431-4970' },
  { matchFirst: 'Eleser', matchLast: 'Perez', username: 'Elieser', phone: '321-566-5517', previousLogin: 'Eleser' },
  { matchFirst: 'Lisvany', matchLast: 'Nunez', username: 'Lisvany', phone: '689-276-9987' },
  { matchFirst: 'Harold', matchLast: 'Suarez', username: 'Harold', phone: '818-465-0895' },
  { matchFirst: 'Joel', matchLast: 'Pozo', username: 'Joel', phone: '321-948-3596' },
  { matchFirst: 'Francisco', matchLast: 'Ledoux', username: 'Francisco', phone: '321-347-4267' },
  { matchFirst: 'Ernesto', matchLast: 'Llambia', username: 'Ernesto', phone: '407-638-1754' },
  { matchFirst: 'Felipe', matchLast: 'Gonzalez', username: 'Felipe', phone: '818-481-4537' },
  { matchFirst: 'Sergio', matchLast: 'Flores', username: 'Sergio', phone: '386-241-4289' },
  { matchFirst: 'Ricardo', matchLast: 'Diaz Gonzalez', username: 'Ricardo', phone: '352-786-2654' },
  { matchFirst: 'Balbino', matchLast: 'Perez', username: 'BALBY', phone: '407-868-2466', previousLogin: 'Balbino' },
  { matchFirst: 'Gabriel', matchLast: 'Cabrera', username: 'Gabriel' },
];

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function findDriverDirectoryOverride(driver) {
  const firstName = normalize(driver.first_name);
  const lastName = normalize(driver.last_name);

  return DRIVER_DIRECTORY_OVERRIDES.find((entry) => {
    const expectedFirst = normalize(entry.matchFirst);
    const expectedLast = normalize(entry.matchLast);
    return firstName.includes(expectedFirst) && lastName.includes(expectedLast);
  }) || null;
}