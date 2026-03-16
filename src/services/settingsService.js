const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getSettings = async () => {
  try {
    let settings = await prisma.settings.findFirst();
    
    // If no settings exist, create default ones
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
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
          swiftCode: 'AXISINBB087'
        }
      });
    }
    
    return settings;
  } catch (error) {
    throw new Error(`Failed to fetch settings: ${error.message}`);
  }
};

const updateSettings = async (settingsData) => {
  try {
    const {
      companyName,
      companyAddress,
      companyPhone,
      companyEmail,
      companyWebsite,
      companyGstin,
      bankName,
      accountNumber,
      ifscCode,
      bankAddress,
      swiftCode
    } = settingsData;

    let settings = await prisma.settings.findFirst();
    
    if (settings) {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: {
          companyName,
          companyAddress,
          companyPhone,
          companyEmail,
          companyWebsite,
          companyGstin,
          bankName,
          accountNumber,
          ifscCode,
          bankAddress,
          swiftCode
        }
      });
    } else {
      settings = await prisma.settings.create({
        data: {
          companyName,
          companyAddress,
          companyPhone,
          companyEmail,
          companyWebsite,
          companyGstin,
          bankName,
          accountNumber,
          ifscCode,
          bankAddress,
          swiftCode
        }
      });
    }
    
    return settings;
  } catch (error) {
    throw new Error(`Failed to update settings: ${error.message}`);
  }
};

module.exports = {
  getSettings,
  updateSettings
};