// Flag emoji is derived from the ISO 3166-1 alpha-2 code using Unicode
// regional indicator symbols — no image assets needed.
export function countryFlag(code) {
  if (!code || code.length !== 2) return '🏳️';
  const A = 0x1f1e6;
  const base = 'A'.charCodeAt(0);
  return String.fromCodePoint(
    A + (code.toUpperCase().charCodeAt(0) - base),
    A + (code.toUpperCase().charCodeAt(1) - base)
  );
}

export const COUNTRIES = [
  ['CM', 'Cameroon'], ['NG', 'Nigeria'], ['GH', 'Ghana'], ['KE', 'Kenya'], ['ZA', 'South Africa'],
  ['EG', 'Egypt'], ['MA', 'Morocco'], ['TZ', 'Tanzania'], ['UG', 'Uganda'], ['SN', 'Senegal'],
  ['CI', "Côte d'Ivoire"], ['ET', 'Ethiopia'], ['RW', 'Rwanda'], ['ZM', 'Zambia'], ['ZW', 'Zimbabwe'],
  ['DZ', 'Algeria'], ['TN', 'Tunisia'], ['BJ', 'Benin'], ['TG', 'Togo'], ['GA', 'Gabon'],
  ['US', 'United States'], ['CA', 'Canada'], ['GB', 'United Kingdom'], ['IE', 'Ireland'],
  ['FR', 'France'], ['DE', 'Germany'], ['ES', 'Spain'], ['PT', 'Portugal'], ['IT', 'Italy'],
  ['NL', 'Netherlands'], ['BE', 'Belgium'], ['CH', 'Switzerland'], ['SE', 'Sweden'], ['NO', 'Norway'],
  ['PL', 'Poland'], ['RO', 'Romania'], ['GR', 'Greece'], ['TR', 'Turkey'],
  ['AE', 'United Arab Emirates'], ['SA', 'Saudi Arabia'], ['QA', 'Qatar'], ['IL', 'Israel'],
  ['IN', 'India'], ['PK', 'Pakistan'], ['BD', 'Bangladesh'], ['ID', 'Indonesia'], ['MY', 'Malaysia'],
  ['SG', 'Singapore'], ['PH', 'Philippines'], ['VN', 'Vietnam'], ['TH', 'Thailand'],
  ['CN', 'China'], ['JP', 'Japan'], ['KR', 'South Korea'],
  ['AU', 'Australia'], ['NZ', 'New Zealand'],
  ['BR', 'Brazil'], ['MX', 'Mexico'], ['AR', 'Argentina'], ['CO', 'Colombia'], ['CL', 'Chile'], ['PE', 'Peru'],
  ['RU', 'Russia'], ['UA', 'Ukraine'],
].sort((a, b) => a[1].localeCompare(b[1]));
