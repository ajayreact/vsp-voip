export {
  fetchContactDetail,
  fetchContacts,
  filterContacts,
  mapExtensionToContact,
} from './contactsService';
export { findContactByNumber } from './contactLookup';
export { buildContactLookupMaps, findContactInMaps, flattenContactsWithSections, groupContactsByLetter } from './contactIndex';
export type { ContactListItem } from './contactIndex';
