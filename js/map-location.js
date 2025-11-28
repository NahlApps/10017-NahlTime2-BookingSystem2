// /js/map-location.js
// Google Maps + service area restriction + location picker

/* Map globals */
let map, marker, autocomplete, areaPolygon, pendingAreaForBounds=null, currentAreaBounds;
let lastValidLatLng = null;
const SA_BOUNDS = { north: 32.154, south: 16.370, west: 34.495, east: 55.666 };

async function loadAreaBounds(areaId){
  if(!areaId) return;

  if(!window.google || !window.google.maps || !map){
    pendingAreaForBounds = areaId;
    return;
  }

  try{
    const params = new URLSearchParams({
      appId: APP_ID,
      areaId: String(areaId)
    });
    const res = await fetch(`${AREA_BOUNDS_URL}?${params.toString()}`, {
      method:'GET',
      cache:'no-store'
    });
    if(!res.ok){
      console.warn('loadAreaBounds HTTP error', res.status);
      return;
    }
    const json = await res.json();
    const payload = json && json.data ? json.data : json;

    if(!payload){
      console.warn('loadAreaBounds: no payload');
      return;
    }

    const boundsObj = payload.bounds || {};
    currentAreaBounds = boundsObj;

    const centerObj = payload.center || {};
    const centerLat = Number(centerObj.lat);
    const centerLng = Number(centerObj.lng);

    const north = Number(boundsObj.north);
    const south = Number(boundsObj.south);
    const east  = Number(boundsObj.east);
    const west  = Number(boundsObj.west);

    let center;
    if(Number.isFinite(centerLat) && Number.isFinite(centerLng)){
      center = new google.maps.LatLng(centerLat, centerLng);
    }else{
      center = map.getCenter();
    }

    if(center){
      map.setCenter(center);
      if(marker){
        marker.setPosition(center);
      }
      lastValidLatLng = center;
    }

    if(Number.isFinite(north) && Number.isFinite(south) && Number.isFinite(east) && Number.isFinite(west)){
      const areaLatLngBounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(south, west),
        new google.maps.LatLng(north, east)
      );
      map.setOptions({
        restriction:{
          latLngBounds: areaLatLngBounds,
          strictBounds:true
        }
      });
      map.fitBounds(areaLatLngBounds);
    }

    const poly = payload.polygon;
    if(poly && Array.isArray(poly) && poly.length){
      const path = poly.map(pt=>{
        const lat = Number(pt.lat ?? pt[0]);
        const lng = Number(pt.lng ?? pt[1]);
        return {lat, lng};
      }).filter(p=>Number.isFinite(p.lat) && Number.isFinite(p.lng));
      if(path.length){
        if(areaPolygon){
          areaPolygon.setMap(null);
        }
        areaPolygon = new google.maps.Polygon({
          paths: path,
          strokeColor: '#027A93',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#027A93',
          fillOpacity: 0.08
        });
        areaPolygon.setMap(map);
      }
    }
  }catch(err){
    console.error('loadAreaBounds error:', err);
  }
}

function requestAreaBoundsForCurrentArea(){
  const areaId = $('#area').val() || '';
  if(!areaId) return;
  loadAreaBounds(areaId);
}

function initMap(){
  const def={lat:24.7136,lng:46.6753};
  map=new google.maps.Map(document.getElementById('googleMap'),{
    center:def, zoom:12, disableDoubleClickZoom:true, mapTypeControl:false, fullscreenControl:true,
    restriction:{latLngBounds: SA_BOUNDS, strictBounds:false}
  });
  marker=new google.maps.Marker({
    position:def,
    map,
    draggable:true,
    title:'اسحب أو اضغط لتحديد الموقع'
  });
  lastValidLatLng = def;

  const setPos = (latLng, pan = false) => {
    if (!latLng) return;

    if (areaPolygon && google.maps && google.maps.geometry && google.maps.geometry.poly && typeof google.maps.geometry.poly.containsLocation === 'function') {
      const inside = google.maps.geometry.poly.containsLocation(latLng, areaPolygon);
      if (!inside) {
        if (lastValidLatLng) {
          const last = (lastValidLatLng.lat && lastValidLatLng.lng)
            ? new google.maps.LatLng(lastValidLatLng.lat, lastValidLatLng.lng)
            : lastValidLatLng;
          marker.setPosition(last);
          map.panTo(last);
        }
        showToast('error','الخدمة متاحة فقط داخل المنطقة المحددة على الخريطة');
        return;
      }
    }

    marker.setPosition(latLng);
    if (pan){ map.panTo(latLng); }
    map.setZoom(17);

    positionUrl=`https://www.google.com/maps/search/?api=1&query=${latLng.lat()},${latLng.lng()}`;
    lastValidLatLng = latLng;

    const hint=document.getElementById('mapHint');
    if(hint) hint.innerHTML=`تم اختيار الموقع: <strong>${latLng.lat().toFixed(5)}, ${latLng.lng().toFixed(5)}</strong>`;
    renderSummary('page6'); updateNextAvailability();
  };

  marker.addListener('dragend',({latLng})=>setPos(latLng));
  map.addListener('click',({latLng})=>setPos(latLng,true));

  const input=document.getElementById('mapSearch');
  const opts={ fields:['geometry','name'], componentRestrictions:{country:'sa'}, strictBounds:false };
  autocomplete=new google.maps.places.Autocomplete(input, opts);
  autocomplete.bindTo('bounds', map);
  autocomplete.addListener('place_changed', ()=>{
    const place=autocomplete.getPlace(); if(!place?.geometry) return;
    const loc=place.geometry.location;
    map.panTo(loc); map.setZoom(16); setPos(loc,true);
  });

  const btn=document.getElementById('show-my-location');
  btn?.addEventListener('click',()=>{
    if(!navigator.geolocation){ showToast('error','المتصفح لا يدعم تحديد الموقع'); return; }
    navigator.geolocation.getCurrentPosition(
      pos=>setPos(new google.maps.LatLng(pos.coords.latitude,pos.coords.longitude),true),
      err=>{ showToast('error','تعذر تحديد موقعك'); },
      { enableHighAccuracy:true, timeout:10000, maximumAge:30000 }
    );
  });

  if(pendingAreaForBounds){
    loadAreaBounds(pendingAreaForBounds);
    pendingAreaForBounds = null;
  } else {
    requestAreaBoundsForCurrentArea();
  }
}
window.initMap=initMap;
