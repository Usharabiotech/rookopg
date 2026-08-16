/**
 * Response shapes from the backend API.
 *
 * TODO: move to packages/api-contracts and generate from the OpenAPI document
 * so these cannot drift. Kept local until the shared package exists.
 */

export type OrgRole = 'OWNER' | 'MANAGER';

export interface Membership {
  orgId: string;
  orgName: string;
  role: OrgRole;
  propertyIds: string[];
  canCreateProperties: boolean;
}

export interface AuthUser {
  id: string;
  phone: string;
  fullName?: string;
  memberships: Membership[];
  platformRoles: string[];
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  accessExpiresInSeconds: number;
  user: AuthUser;
}

export interface Organisation {
  id: string;
  name: string;
  legalName?: string;
  status: string;
  verificationStatus: string;
  freePeriodMonths: number;
  freePeriodStartsAt?: string;
  myRole: OrgRole;
  propertyCount: number;
  createdAt: string;
}

export interface PropertySummary {
  id: string;
  orgId: string;
  name: string;
  propertyType: string;
  genderPolicy: 'MEN' | 'WOMEN' | 'CO_LIVING';
  localityName: string;
  pincode: string;
  totalBeds: number;
  availableBeds: number;
  roomCount: number;
  listingStatus: string;
  createdAt: string;
}

export interface MealPlan {
  foodType: 'VEG' | 'NON_VEG' | 'BOTH' | 'NONE';
  breakfast?: boolean;
  lunch?: boolean;
  dinner?: boolean;
  includedInRent?: boolean;
  extraChargePaise?: number;
  notes?: string;
}

export interface PropertyRules {
  gateClosingTime?: string;
  visitorsAllowed?: boolean;
  smokingAllowed?: boolean;
  alcoholAllowed?: boolean;
  cookingAllowed?: boolean;
  notes?: string;
}

export interface PropertyDetail extends PropertySummary {
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  localityId: string;
  latitude?: number;
  longitude?: number;
  contactPhone?: string;
  defaultRentCycleDay?: number;
  amenityCodes: string[];
  mealPlan?: MealPlan;
  rules?: PropertyRules;
}

export interface Bed {
  id: string;
  code: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  rentPaise: number;
  occupied: boolean;
  availableFrom?: string;
  reservedFrom?: string;
}

export type SharingType = 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'QUAD' | 'DORMITORY';

export interface Room {
  id: string;
  propertyId: string;
  code: string;
  floor?: number;
  sharingType: SharingType;
  sharingCapacity: number;
  saleMode: 'PER_BED' | 'WHOLE_ROOM';
  gender: 'MEN' | 'WOMEN' | 'ANY';
  baseRentPaise: number;
  depositPaise: number;
  hasAc: boolean;
  hasAttachedBath: boolean;
  hasBalcony: boolean;
  status: string;
  beds: Bed[];
}

export interface Locality {
  id: string;
  name: string;
  slug: string;
  city: string;
}

export interface Amenity {
  code: string;
  name: string;
  category: string;
  isFilterable: boolean;
}

export interface OrgMember {
  membershipId: string;
  userId: string;
  phone: string;
  fullName?: string;
  role: OrgRole;
  active: boolean;
  canCreateProperties: boolean;
  propertyIds: string[];
  hasSignedIn: boolean;
  addedAt: string;
}

export interface TenantSummary {
  id: string;
  fullName: string;
  phone: string;
  hasClaimedAccount: boolean;
}

export interface Tenancy {
  id: string;
  propertyId: string;
  bedId: string;
  roomCode: string;
  bedCode: string;
  tenant: TenantSummary;
  startDate: string;
  endDate?: string;
  agreedRentPaise: number;
  depositPaise: number;
  cycleAnchorDay?: number;
  noticeDays: number;
  status: 'ACTIVE' | 'NOTICE_GIVEN' | 'ENDED';
  source: 'ONLINE' | 'OFFLINE';
  createdAt: string;
}

export interface Invoice {
  id: string;
  tenancyId: string;
  kind: string;
  status: 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'VOID' | 'WRITTEN_OFF';
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amountPaise: number;
  paidPaise: number;
  outstandingPaise: number;
  isProRata: boolean;
  description?: string;
  daysOverdue: number;
}

export interface TenantDues {
  tenancyId: string;
  tenantName: string;
  phone: string;
  roomCode: string;
  bedCode: string;
  monthlyRentPaise: number;
  outstandingPaise: number;
  creditPaise: number;
  oldestDueDate?: string;
  daysOverdue: number;
  invoices: Invoice[];
}

export interface CollectionSummary {
  billedPaise: number;
  collectedPaise: number;
  outstandingPaise: number;
  tenantsInArrears: number;
  tenantCount: number;
}

export interface DuesResponse {
  summary: CollectionSummary;
  tenants: TenantDues[];
}

export interface PaymentReceipt {
  paymentId: string;
  amountPaise: number;
  allocatedPaise: number;
  creditPaise: number;
  settled: Invoice[];
}

export type MediaTag =
  | 'EXTERIOR'
  | 'ROOM'
  | 'BATHROOM'
  | 'KITCHEN'
  | 'COMMON_AREA'
  | 'DINING'
  | 'ENTRANCE'
  | 'OTHER';

export interface Media {
  id: string;
  propertyId: string;
  roomId?: string;
  tag: MediaTag;
  sortOrder: number;
  sizeBytes: number;
  moderation: string;
  createdAt: string;
  displayUrl: string;
  thumbUrl: string;
}

// ---------------------------------------------------------------------------
// Public marketplace
// ---------------------------------------------------------------------------

export interface SharingOption {
  sharingType: string;
  fromRentPaise: number;
  freeBeds: number;
  hasAc: boolean;
}

export interface ListingCard {
  slug: string;
  name: string;
  localityName: string;
  genderPolicy: 'MEN' | 'WOMEN' | 'CO_LIVING';
  propertyType: string;
  headline?: string;
  fromRentPaise: number;
  freeBeds: number;
  totalBeds: number;
  coverPhotoId?: string;
  amenityCodes: string[];
  foodType?: string;
  sharingOptions: SharingOption[];
}

export interface PublicRoom {
  sharingType: string;
  rentPaise: number;
  depositPaise: number;
  freeBeds: number;
  totalBeds: number;
  hasAc: boolean;
  hasAttachedBath: boolean;
  gender: string;
}

export interface PublicListing extends ListingCard {
  propertyId: string;
  description?: string;
  addressLine1: string;
  landmark?: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  photoIds: string[];
  rooms: PublicRoom[];
  mealsIncluded?: string;
  gateClosingTime?: string;
  visitorsAllowed: boolean;
  houseRules?: string;
  availabilityConfirmedAt?: string;
}

export interface SearchResults {
  results: ListingCard[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LocalityCount {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export interface BookingPrice {
  rentPaise: number;
  depositPaise: number;
  convenienceFeePaise: number;
  totalPayablePaise: number;
}

export interface Booking {
  id: string;
  status:
    | 'DRAFT'
    | 'HELD'
    | 'PENDING_PAYMENT'
    | 'PAYMENT_FAILED'
    | 'PENDING_APPROVAL'
    | 'CONFIRMED'
    | 'CHECKED_IN'
    | 'CANCELLED'
    | 'REJECTED'
    | 'EXPIRED'
    | 'NO_SHOW';
  propertyName: string;
  localityName: string;
  listingSlug?: string;
  roomCode: string;
  bedCode: string;
  sharingType: string;
  moveInDate: string;
  price: BookingPrice;
  orderId?: string;
  holdExpiresAt?: string;
  approvalExpiresAt?: string;
  tenantName?: string;
  tenantPhone?: string;
  createdAt: string;
}

export interface Checkout {
  booking: Booking;
  orderId: string;
  amountPaise: number;
  publicKey?: string;
  provider: string;
}

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
