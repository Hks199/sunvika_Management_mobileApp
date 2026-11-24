import { Types } from 'mongoose';
import { EmployeeModel } from '../../employees/models/employee.model.js';
import { RoleModel } from '../../roles/models/role.model.js';
import { LeadModel } from '../../leads/models/lead.model.js';
import { CustomerModel } from '../models/customer.model.js';
import { CustomerDocumentModel } from '../models/customer-document.model.js';

// Enrol earlier CP-submitted customers without changing their document history.
export async function backfillCpCustomerReviews() {
  const role = await RoleModel.findOne({ code: 'CP' }).select('_id').lean();
  if (!role) return;
  const cps = await EmployeeModel.find({ role: role._id }).select('_id').lean();
  if (!cps.length) return;
  const docs = await CustomerDocumentModel.find({ uploadedBy: { $in: cps.map(cp => cp._id) } }).select('customer uploadedBy documentType').sort({ uploadedAt: -1, _id: -1 }).lean();
  if (!docs.length) return;
  const customerIds = [...new Map(docs.map(doc => [String(doc.customer), doc.customer])).values()];
  const customers = await CustomerModel.find({ _id: { $in: customerIds }, reviewCp: { $exists: false } }).select('_id creatorId sourceLead').lean();
  const leads = await LeadModel.find({ _id: { $in: customers.map(customer => customer.sourceLead) } }).select('_id assignedTo').lean();
  const assigned = new Map(leads.map(lead => [String(lead._id), lead.assignedTo]));
  const documents = new Map<string, typeof docs>();
  for (const doc of docs) { const key = String(doc.customer); const group = documents.get(key) ?? []; group.push(doc); documents.set(key, group); }
  for (const customer of customers) {
    const uploads = documents.get(String(customer._id)) ?? [];
    const owner = uploads.find(doc => doc.uploadedBy.equals(customer.creatorId) || (assigned.get(String(customer.sourceLead)) as Types.ObjectId | undefined)?.equals(doc.uploadedBy));
    if (!owner) continue;
    const hasPhoto = uploads.some(doc => doc.documentType === 'GEO_TAG_PHOTO') || Boolean(await CustomerDocumentModel.exists({ customer: customer._id, documentType: 'GEO_TAG_PHOTO' }));
    await CustomerModel.updateOne({ _id: customer._id, reviewCp: { $exists: false } }, { $set: { reviewCp: owner.uploadedBy, reviewRequiredTypes: ['PAN', 'AADHAAR', 'ELECTRICITY_BILL', 'BANK_PASSBOOK', ...(hasPhoto ? ['GEO_TAG_PHOTO'] : [])] } });
  }
}
