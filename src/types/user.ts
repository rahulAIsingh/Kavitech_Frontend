export interface UserDto {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  accountStatus: string;
  lastLoginAtUtc?: string;
  roles: string[];
}

export interface CreateUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  roles: string[];
}

export interface UpdateUserRequest {
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: string[];
}

export interface PagedRequest {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
