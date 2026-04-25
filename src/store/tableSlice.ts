import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface TableState {
  data: any[];
  columns: any[];
  loading: boolean;
  error: string | null;
  currentPage: number;
  pageSize: number;
  total: number;
  sortConfig: { field: string; direction: 'asc' | 'desc' } | null;
  filters: Record<string, any>;
  searchTerm: string;
}

const initialState: TableState = {
  data: [],
  columns: [],
  loading: false,
  error: null,
  currentPage: 1,
  pageSize: 50,
  total: 0,
  sortConfig: null,
  filters: {},
  searchTerm: '',
};

const tableSlice = createSlice({
  name: 'table',
  initialState,
  reducers: {
    setData: (state, action: PayloadAction<any[]>) => {
      state.data = action.payload;
      state.total = action.payload.length;
    },
    setColumns: (state, action: PayloadAction<any[]>) => {
      state.columns = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },
    setPageSize: (state, action: PayloadAction<number>) => {
      state.pageSize = action.payload;
      state.currentPage = 1;
    },
    setSortConfig: (state, action: PayloadAction<{ field: string; direction: 'asc' | 'desc' } | null>) => {
      state.sortConfig = action.payload;
    },
    setFilters: (state, action: PayloadAction<Record<string, any>>) => {
      state.filters = action.payload;
      state.currentPage = 1;
    },
    setSearchTerm: (state, action: PayloadAction<string>) => {
      state.searchTerm = action.payload;
      state.currentPage = 1;
    },
    updateCell: (state, action: PayloadAction<{ rowIndex: number; columnField: string; value: any }>) => {
      const { rowIndex, columnField, value } = action.payload;
      if (state.data[rowIndex]) {
        state.data[rowIndex][columnField] = value;
      }
    },
  },
});

export const { 
  setData, 
  setColumns, 
  setLoading, 
  setError, 
  setCurrentPage, 
  setPageSize, 
  setSortConfig, 
  setFilters, 
  setSearchTerm, 
  updateCell 
} = tableSlice.actions;

export default tableSlice.reducer;
