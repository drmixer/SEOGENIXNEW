import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Clock, RefreshCw, Server, Database, Globe, Zap, Shield } from 'lucide-react';

const Status = () => {
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // System status data - in a real app, this would come from an API
  const [systems, setSystems] = useState([
    { 
      name: 'API Services', 
      status: 'operational', 
      icon: Server,
      components: [
        { name: 'Audit API', status: 'operational', latency: '124ms' },
        { name: 'Schema API', status: 'operational', latency: '98ms' },
        { name: 'Citations API', status: 'operational', latency: '156ms' },
        { name: 'Content API', status: 'operational', latency: '112ms' }
      ]
    },
    { 
      name: 'Database Services', 
      status: 'operational', 
      icon: Database,
      components: [
        { name: 'User Database', status: 'operational', latency: '45ms' },
        { name: 'Audit History', status: 'operational', latency: '62ms' },
        { name: 'Analytics Database', status: 'operational', latency: '78ms' }
      ]
    },
    { 
      name: 'Web Applications', 
      status: 'operational', 
      icon: Globe,
      components: [
        { name: 'Dashboard', status: 'operational', latency: '320ms' },
        { name: 'Marketing Site', status: 'operational', latency: '285ms' },
        { name: 'Developer Portal', status: 'operational', latency: '305ms' }
      ]
    },
    { 
      name: 'AI Processing', 
      status: 'partial_outage', 
      icon: Zap,
      components: [
        { name: 'Content Analysis', status: 'operational', latency: '1.2s' },
        { name: 'Entity Recognition', status: 'operational', latency: '0.9s' },
        { name: 'Citation Tracking', status: 'partial_outage', latency: '3.5s' },
        { name: 'Voice Assistant Simulation', status: 'operational', latency: '1.8s' }
      ]
    },
    { 
      name: 'Authentication', 
      status: 'operational', 
      icon: Shield,
      components: [
        { name: 'User Authentication', status: 'operational', latency: '110ms' },
        { name: 'API Authentication', status: 'operational', latency: '95ms' },
        { name: 'SSO Services', status: 'operational', latency: '125ms' }
      ]
    }
  ]);

  // Incidents - in a real app, this would come from an API
  const [incidents, setIncidents] = useState([
    {
      id: 'INC-2025-06-12',
      title: 'Citation Tracking API Degraded Performance',
      status: 'investigating',
      started: '2025-06-12T08:45:00Z',
      resolved: null,
      updates: [
        {
          timestamp: '2025-06-12T08:45:00Z',
          message: 'We are investigating reports of slow response times from the Citation Tracking API.'
        },
        {
          timestamp: '2025-06-12T09:15:00Z',
          message: 'The issue has been identified as increased load on our citation processing servers. We are scaling up capacity to address the issue.'
        },
        {
          timestamp: '2025-06-12T09:45:00Z',
          message: 'We have implemented a temporary fix to improve performance while we work on a permanent solution. Users may experience intermittent delays.'
        }
      ]
    },
    {
      id: 'INC-2025-06-10',
      title: 'Dashboard Loading Issues',
      status: 'resolved',
      started: '2025-06-10T14:22:00Z',
      resolved: '2025-06-10T16:45:00Z',
      updates: [
        {
          timestamp: '2025-06-10T14:22:00Z',
          message: 'We are investigating reports of slow dashboard loading times for some users.'
        },
        {
          timestamp: '2025-06-10T15:10:00Z',
          message: 'The issue has been identified as a caching problem affecting approximately 15% of users.'
        },
        {
          timestamp: '2025-06-10T16:45:00Z',
          message: 'The issue has been resolved. Dashboard loading times have returned to normal for all users.'
        }
      ]
    }
  ]);

  // Maintenance windows - in a real app, this would come from an API
  const [maintenanceWindows, setMaintenanceWindows] = useState([
    {
      id: 'MAINT-2025-06-15',
      title: 'Database Optimization',
      status: 'scheduled',
      start: '2025-06-15T02:00:00Z',
      end: '2025-06-15T04:00:00Z',
      description: 'Scheduled database maintenance to improve performance. Some services may experience brief interruptions during this time.'
    }
  ]);

  useEffect(() => {
    // Simulate loading data
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  const refreshStatus = () => {
    setRefreshing(true);
    
    // Simulate refreshing data
    setTimeout(() => {
      setLastUpdated(new Date());
      setRefreshing(false);
    }, 1500);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'partial_outage':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'major_outage':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'maintenance':
        return <Clock className="w-5 h-5 text-blue-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'operational':
        return 'Operational';
      case 'partial_outage':
        return 'Partial Outage';
      case 'major_outage':
        return 'Major Outage';
      case 'maintenance':
        return 'Maintenance';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'bg-green-100 text-green-800';
      case 'partial_outage':
        return 'bg-yellow-100 text-yellow-800';
      case 'major_outage':
        return 'bg-red-100 text-red-800';
      case 'maintenance':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getIncidentStatusColor = (status: string) => {
    switch (status) {
      case 'investigating':
        return 'bg-yellow-100 text-yellow-800';
      case 'identified':
        return 'bg-blue-100 text-blue-800';
      case 'monitoring':
        return 'bg-purple-100 text-purple-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate overall system status
  const getOverallStatus = () => {
    if (systems.some(system => system.status === 'major_outage')) {
      return 'major_outage';
    } else if (systems.some(system => system.status === 'partial_outage')) {
      return 'partial_outage';
    } else if (systems.some(system => system.status === 'maintenance')) {
      return 'maintenance';
    } else {
      return 'operational';
    }
  };

  const overallStatus = getOverallStatus();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 py-20 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-6">
              System Status
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Check the current status of SEOGENIX services and view recent incidents.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <>
            {/* Overall Status */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div className="flex items-center mb-4 md:mb-0">
                  {getStatusIcon(overallStatus)}
                  <h2 className="text-2xl font-bold text-gray-900 ml-3">
                    {overallStatus === 'operational' 
                      ? 'All Systems Operational' 
                      : overallStatus === 'partial_outage'
                        ? 'Partial System Outage'
                        : overallStatus === 'major_outage'
                          ? 'Major System Outage'
                          : 'System Maintenance'}
                  </h2>
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
                  <button 
                    onClick={refreshStatus}
                    disabled={refreshing}
                    className="ml-3 text-purple-600 hover:text-purple-700 disabled:text-gray-400"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Active Incidents */}
            {incidents.some(incident => !incident.resolved) && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Active Incidents</h2>
                
                <div className="space-y-4">
                  {incidents
                    .filter(incident => !incident.resolved)
                    .map(incident => (
                      <div key={incident.id} className="bg-white rounded-xl shadow-sm border border-yellow-200 p-6">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                          <div className="flex items-center mb-2 md:mb-0">
                            <AlertTriangle className="w-5 h-5 text-yellow-500" />
                            <h3 className="font-semibold text-gray-900 ml-2">{incident.title}</h3>
                          </div>
                          <div className="flex items-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getIncidentStatusColor(incident.status)}`}>
                              {incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
                            </span>
                            <span className="ml-3 text-sm text-gray-500">
                              Started: {formatDate(incident.started)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="border-t border-gray-100 pt-4 mt-4">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Updates:</h4>
                          <div className="space-y-3">
                            {incident.updates.map((update, index) => (
                              <div key={index} className="flex">
                                <div className="flex-shrink-0 mr-3">
                                  <div className="w-2 h-2 rounded-full bg-gray-300 mt-2"></div>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-600">{update.message}</p>
                                  <p className="text-xs text-gray-500 mt-1">{formatDate(update.timestamp)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
            
            {/* System Components */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">System Components</h2>
              
              <div className="space-y-6">
                {systems.map((system, index) => {
                  const SystemIcon = system.icon;
                  return (
                    <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="p-6 flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="bg-gray-100 p-2 rounded-lg">
                            <SystemIcon className="w-6 h-6 text-gray-700" />
                          </div>
                          <h3 className="font-semibold text-gray-900 ml-3">{system.name}</h3>
                        </div>
                        <div className="flex items-center">
                          {getStatusIcon(system.status)}
                          <span className={`ml-2 text-sm font-medium ${
                            system.status === 'operational' ? 'text-green-700' :
                            system.status === 'partial_outage' ? 'text-yellow-700' :
                            system.status === 'major_outage' ? 'text-red-700' :
                            'text-blue-700'
                          }`}>
                            {getStatusText(system.status)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="border-t border-gray-100">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Component
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Latency
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {system.components.map((component, idx) => (
                              <tr key={idx}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {component.name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    {getStatusIcon(component.status)}
                                    <span className="ml-2 text-sm font-medium text-gray-700">
                                      {getStatusText(component.status)}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {component.latency}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Scheduled Maintenance */}
            {maintenanceWindows.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Scheduled Maintenance</h2>
                
                <div className="space-y-4">
                  {maintenanceWindows.map(maintenance => (
                    <div key={maintenance.id} className="bg-white rounded-xl shadow-sm border border-blue-200 p-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                        <div className="flex items-center mb-2 md:mb-0">
                          <Clock className="w-5 h-5 text-blue-500" />
                          <h3 className="font-semibold text-gray-900 ml-2">{maintenance.title}</h3>
                        </div>
                        <div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {maintenance.status.charAt(0).toUpperCase() + maintenance.status.slice(1)}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-gray-600 mb-4">{maintenance.description}</p>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center text-sm text-gray-500">
                        <span>Start: {formatDate(maintenance.start)}</span>
                        <span className="hidden sm:inline mx-2">•</span>
                        <span>End: {formatDate(maintenance.end)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Past Incidents */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Past Incidents</h2>
              
              <div className="space-y-4">
                {incidents
                  .filter(incident => incident.resolved)
                  .map(incident => (
                    <div key={incident.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                        <div className="flex items-center mb-2 md:mb-0">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <h3 className="font-semibold text-gray-900 ml-2">{incident.title}</h3>
                        </div>
                        <div className="flex items-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Resolved
                          </span>
                          <span className="ml-3 text-sm text-gray-500">
                            {formatDate(incident.resolved as string)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-500 mb-4">
                        Duration: {formatDate(incident.started)} - {formatDate(incident.resolved as string)}
                      </div>
                      
                      <details className="text-sm">
                        <summary className="text-purple-600 hover:text-purple-700 cursor-pointer font-medium">
                          View incident details
                        </summary>
                        <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-200">
                          {incident.updates.map((update, index) => (
                            <div key={index}>
                              <p className="text-gray-600">{update.message}</p>
                              <p className="text-xs text-gray-500 mt-1">{formatDate(update.timestamp)}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Status;