const { sendResponse, sendError, parseQueryParams } = require('../utils/helpers');
const { LeadService } = require('../services/leadService');

class LeadController {
  static async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder, source } = parseQueryParams(req.query);
      const result = await LeadService.getAll(page, limit, search, sortBy, sortOrder, source);
      return sendResponse(res, 200, true, result.leads, 'Leads retrieved successfully', result.pagination);
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getById(req, res) {
    try {
      const lead = await LeadService.getById(req.params.id);
      return sendResponse(res, 200, true, lead, 'Lead retrieved successfully');
    } catch (error) {
      return sendError(res, 404, error.message);
    }
  }

  static async create(req, res) {
    try {
      const { name, email, phone, company, country, message, formType } = req.body;
      if (!name) return sendError(res, 400, 'Name is required');
      const lead = await LeadService.create({
        name,
        email: email ? email.toLowerCase() : null,
        phone: phone || null,
        company: company || null,
        country: country || null,
        message: message || null,
        formType: formType || 'Manual',
        source: 'manual',
        status: 'new',
      });
      return sendResponse(res, 201, true, lead, 'Lead created successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async update(req, res) {
    try {
      const lead = await LeadService.update(req.params.id, req.body);
      return sendResponse(res, 200, true, lead, 'Lead updated successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async delete(req, res) {
    try {
      const result = await LeadService.delete(req.params.id);
      return sendResponse(res, 200, true, result, 'Lead deleted successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }
}

module.exports = { LeadController };
