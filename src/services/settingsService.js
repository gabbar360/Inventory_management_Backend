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

  if (settings) {
    settings = await prisma.settings.update({ where: { id: settings.id }, data });
  } else {
    settings = await prisma.settings.create({ data: { ...DEFAULT_SETTINGS, ...data } });
  }
  return settings;
};

module.exports = { getSettings, updateSettings };
