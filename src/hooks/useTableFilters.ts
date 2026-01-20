import { useState, useMemo } from 'react';

interface UseTableFiltersProps<T> {
  data: T[];
  searchFields: (keyof T)[];
  defaultSortBy: string;
  sortFunctions: Record<string, (a: T, b: T) => number>;
  filterFunction?: (item: T, filterValue: string) => boolean;
}

export const useTableFilters = <T,>({
  data,
  searchFields,
  defaultSortBy,
  sortFunctions,
  filterFunction,
}: UseTableFiltersProps<T>) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [filterBy, setFilterBy] = useState('all');

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Apply search filter
    if (searchTerm) {
      result = result.filter((item) =>
        searchFields.some((field) => {
          const value = item[field];
          if (typeof value === 'string') {
            return value.toLowerCase().includes(searchTerm.toLowerCase());
          }
          if (typeof value === 'number') {
            return value.toString().includes(searchTerm);
          }
          return false;
        })
      );
    }

    // Apply custom filter
    if (filterBy !== 'all' && filterFunction) {
      result = result.filter((item) => filterFunction(item, filterBy));
    }

    // Apply sorting
    const sortFunction = sortFunctions[sortBy];
    if (sortFunction) {
      result.sort(sortFunction);
    }

    return result;
  }, [data, searchTerm, sortBy, filterBy, searchFields, sortFunctions, filterFunction]);

  const clearFilters = () => {
    setSearchTerm('');
    setSortBy(defaultSortBy);
    setFilterBy('all');
  };

  return {
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    filterBy,
    setFilterBy,
    filteredAndSortedData,
    clearFilters,
  };
};
