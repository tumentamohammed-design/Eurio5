import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const BrokersContext = createContext(null);

export function BrokersProvider({ children }) {
  const [brokers, setBrokers] = useState([]);
  const [brokersLoading, setBrokersLoading] = useState(false);
  const [brokersError, setBrokersError] = useState(null);

  const [propFirms, setPropFirms] = useState([]);
  const [propFirmsLoading, setPropFirmsLoading] = useState(false);
  const [propFirmsError, setPropFirmsError] = useState(null);

  const loadBrokers = useCallback(async () => {
    setBrokersLoading(true);
    setBrokersError(null);
    const { data, error } = await supabase.from('brokers').select('*').eq('active', true).order('rating', { ascending: false });
    if (error) { console.error('loadBrokers error', error); setBrokersError(error.message); }
    setBrokers(data || []);
    setBrokersLoading(false);
  }, []);

  const loadPropFirms = useCallback(async () => {
    setPropFirmsLoading(true);
    setPropFirmsError(null);
    const { data, error } = await supabase.from('prop_firms').select('*').eq('active', true).order('rating', { ascending: false });
    if (error) { console.error('loadPropFirms error', error); setPropFirmsError(error.message); }
    setPropFirms(data || []);
    setPropFirmsLoading(false);
  }, []);

  useEffect(() => { loadBrokers(); loadPropFirms(); }, [loadBrokers, loadPropFirms]);

  // Admin CRUD — RLS (brokers_admin_write / prop_firms_admin_write) is the
  // real enforcement; these just fail loudly for a non-admin rather than
  // silently doing nothing.
  const addBroker = useCallback(async (broker) => {
    const { error } = await supabase.from('brokers').insert(broker);
    if (error) throw error;
    await loadBrokers();
  }, [loadBrokers]);
  const updateBroker = useCallback(async (id, patch) => {
    const { error } = await supabase.from('brokers').update(patch).eq('id', id);
    if (error) throw error;
    await loadBrokers();
  }, [loadBrokers]);
  const deleteBroker = useCallback(async (id) => {
    const { error } = await supabase.from('brokers').delete().eq('id', id);
    if (error) throw error;
    await loadBrokers();
  }, [loadBrokers]);

  const addPropFirm = useCallback(async (firm) => {
    const { error } = await supabase.from('prop_firms').insert(firm);
    if (error) throw error;
    await loadPropFirms();
  }, [loadPropFirms]);
  const updatePropFirm = useCallback(async (id, patch) => {
    const { error } = await supabase.from('prop_firms').update(patch).eq('id', id);
    if (error) throw error;
    await loadPropFirms();
  }, [loadPropFirms]);
  const deletePropFirm = useCallback(async (id) => {
    const { error } = await supabase.from('prop_firms').delete().eq('id', id);
    if (error) throw error;
    await loadPropFirms();
  }, [loadPropFirms]);

  const value = useMemo(() => ({
    brokers, brokersLoading, brokersError, loadBrokers, addBroker, updateBroker, deleteBroker,
    propFirms, propFirmsLoading, propFirmsError, loadPropFirms, addPropFirm, updatePropFirm, deletePropFirm,
  }), [
    brokers, brokersLoading, brokersError, loadBrokers, addBroker, updateBroker, deleteBroker,
    propFirms, propFirmsLoading, propFirmsError, loadPropFirms, addPropFirm, updatePropFirm, deletePropFirm,
  ]);

  return <BrokersContext.Provider value={value}>{children}</BrokersContext.Provider>;
}

export function useBrokers() {
  const ctx = useContext(BrokersContext);
  if (!ctx) throw new Error('useBrokers must be used inside <BrokersProvider>');
  return ctx;
}
