import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { useDebounce } from '../hooks/useDebounce';

interface CMSContentPickerProps {
  cmsType: 'wordpress' | 'shopify';
  onContentSelect: (content: any) => void;
}

const CMSContentPicker: React.FC<CMSContentPickerProps> = ({ cmsType, onContentSelect }) => {
  const [content, setContent] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination state
  const [page, setPage] = useState(1); // For WordPress
  const [nextPageInfo, setNextPageInfo] = useState<string | null>(null); // For Shopify
  const [hasNextPage, setHasNextPage] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Effect for initial load and search term changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    setContent([]);
    setPage(1);
    setNextPageInfo(null);
    setHasNextPage(false);

    const fetchInitialContent = async () => {
      try {
        const options = { search: debouncedSearchTerm, page: 1 };
        const data = await apiService.getCMSContentList(cmsType, options);

        const newItems = data.items || [];
        setContent(newItems);

        if (cmsType === 'wordpress') {
          setHasNextPage(newItems.length > 0); // Assume more if we get a full page
          setPage(2); // Set page for the *next* load
        } else { // Shopify
          setHasNextPage(!!data.nextPageInfo);
          setNextPageInfo(data.nextPageInfo || null);
        }
      } catch (err) {
        setError('Failed to fetch content. Please ensure your CMS is connected and try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialContent();
  }, [debouncedSearchTerm, cmsType]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    setError(null);

    try {
      const options: { page?: number; search?: string; page_info?: string } = { search: debouncedSearchTerm };
      if (cmsType === 'wordpress') {
        options.page = page;
      } else {
        options.page_info = nextPageInfo || undefined;
      }

      const data = await apiService.getCMSContentList(cmsType, options);

      const newItems = data.items || [];
      setContent(prev => [...prev, ...newItems]);

      if (cmsType === 'wordpress') {
        setHasNextPage(newItems.length > 0);
        setPage(p => p + 1);
      } else { // Shopify
        setHasNextPage(!!data.nextPageInfo);
        setNextPageInfo(data.nextPageInfo || null);
      }
    } catch (err) {
      setError('Failed to load more content.');
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSelect = (item: any) => {
    onContentSelect(item);
  };

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search content..."
          className="w-full p-2 border rounded"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {!loading && !error && (
        <>
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {content.length > 0 ? content.map((item) => (
              <li
                key={item.id}
                className="p-2 border rounded cursor-pointer hover:bg-gray-100"
                onClick={() => handleSelect(item)}
              >
                <p className="font-bold">{item.title}</p>
                <p className="text-sm text-gray-500">Type: {item.type}</p>
              </li>
            )) : <p>No content found.</p>}
          </ul>
          {hasNextPage && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CMSContentPicker;
