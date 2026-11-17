export function createLeadPayload(values: Record<string, string>) {
  const value = (key: string) => (values[key] ?? "").trim();
  const customerName = value("customerName"), mobileNumber = value("mobileNumber");
  const alternateNumber = value("alternateNumber"), siteAddress = value("siteAddress");
  const blockOrTehsil = value("blockOrTehsil");
  const phone = /^\+?[0-9]{10,15}$/;
  if (customerName.length < 2 || customerName.length > 160) throw new Error("Customer name must be 2 to 160 characters.");
  if (!phone.test(mobileNumber)) throw new Error("Enter 10 to 15 digits for the mobile number, optionally starting with +.");
  if (alternateNumber && !phone.test(alternateNumber)) throw new Error("Enter a valid alternate number or leave it blank.");
  for (const key of ["state", "district", "branch"]) {
    if (!/^[a-f\d]{24}$/i.test(value(key))) throw new Error(`Choose a ${key}.`);
  }
  if (blockOrTehsil.length > 120) throw new Error("Block / tehsil must be 120 characters or fewer.");
  if (siteAddress.length < 3 || siteAddress.length > 1000) throw new Error("Site address must be 3 to 1,000 characters.");
  return {customerName, mobileNumber, ...(alternateNumber ? {alternateNumber} : {}),
    state:value("state"), district:value("district"), branch:value("branch"),
    ...(blockOrTehsil ? {blockOrTehsil} : {}), siteAddress};
}
