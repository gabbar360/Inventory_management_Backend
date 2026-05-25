const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_SETTINGS = {
  companyName: 'Vegnar Global LLP',
  companyAddress: 'B-623, RK Iconic\n150 Feet Ring Road, Ayodhya Chowk\nRajkot Gujarat 360007\nIndia',
  companyPhone: '+91 9998040482',
  companyEmail: 'sales@vegnar.com',
  companyWebsite: 'www.vegnar.com',
  companyGstin: '24ABAFV3901A1ZV',
  bankName: 'Axis Bank',
  accountNumber: '925020013383048',
  ifscCode: 'UTIB0005420',
  bankAddress: 'Synergy Circle, Rajkot - 360007',
  swiftCode: 'AXISINBB087',
};

const getSettings = async () => {
  let settings = await prisma.settings.findFirst();
  if (!settings) {
    settings = await prisma.settings.create({ data: DEFAULT_SETTINGS });
  }
  return settings;
};

const updateSettings = async (settingsData) => {
  let settings = await prisma.settings.findFirst();
  const data = { ...settingsData };
  // Remove read-only fields
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;

  // Parse Int fields (HTML inputs send strings)
  const intFields = [
    'customerPadding', 'customerCurrent',
    'vendorPadding', 'vendorCurrent',
    'poPadding', 'poCurrent',
    'quotePadding', 'quoteCurrent',
    'salesOrderPadding', 'salesOrderCurrent',
    'invoicePadding', 'invoiceCurrent',
  ];
  for (const field of intFields) {
    if (data[field] !== undefined && data[field] !== '') {
      data[field] = parseInt(data[field], 10) || 0;
    } else if (data[field] === '') {
      data[field] = 0;
    }
  }

  if (settings) {
    settings = await prisma.settings.update({ where: { id: settings.id }, data });
  } else {
    settings = await prisma.settings.create({ data: { ...DEFAULT_SETTINGS, ...data } });
  }
  return settings;
};

// Generate next number for a given type and increment the counter
const generateNextNumber = async (type) => {
  const settings = await prisma.settings.findFirst();
  if (!settings) throw new Error('Settings not found');

  const prefixKey = `${type}Prefix`;
  const middleKey = `${type}Middle`;
  const suffixKey = `${type}Suffix`;
  const paddingKey = `${type}Padding`;
  const currentKey = `${type}Current`;

  const prefix = settings[prefixKey] || '';
  const middle = settings[middleKey] || '';
  const suffix = settings[suffixKey] || '';
  const padding = settings[paddingKey] || 6;
  const current = settings[currentKey] || 0;
  const next = current + 1;

  const number = String(next).padStart(padding, '0');
  const generated = `${prefix}${middle}${number}${suffix}`;

  // Increment counter
  await prisma.settings.update({
    where: { id: settings.id },
    data: { [currentKey]: next },
  });

  return generated;
};

// Preview next number without incrementing
const previewNextNumber = async (type) => {
  const settings = await prisma.settings.findFirst();
  if (!settings) throw new Error('Settings not found');

  const prefixKey = `${type}Prefix`;
  const middleKey = `${type}Middle`;
  const suffixKey = `${type}Suffix`;
  const paddingKey = `${type}Padding`;
  const currentKey = `${type}Current`;

  const prefix = settings[prefixKey] || '';
  const middle = settings[middleKey] || '';
  const suffix = settings[suffixKey] || '';
  const padding = settings[paddingKey] || 6;
  const next = (settings[currentKey] || 0) + 1;

  return `${prefix}${middle}${String(next).padStart(padding, '0')}${suffix}`;
};

module.exports = { getSettings, updateSettings, generateNextNumber, previewNextNumber };
