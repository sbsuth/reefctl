

#include <RF24/RF24.h>
#include <RF24Network/RF24Network.h>
#include <RF24Mesh/RF24Mesh.h>  
#include <RF24Gateway/RF24Gateway.h>

//RF24 radio(RPI_V2_GPIO_P1_15, BCM2835_SPI_CS0, BCM2835_SPI_SPEED_8MHZ); 
RF24 radio(22,0);
RF24Network network(radio);
RF24Mesh mesh(radio,network);
RF24Gateway gw(radio,network,mesh);

void intHandler(){
    
    //Handle RF24Network reads/routing and read/writes of the tun_nrf24 TUN/TAP interface via interrupt
    gw.update(true);

}


int main(int argc, char** argv) {

  //Config for use with RF24Mesh as Master Node
  //uint8_t nodeID=0;

	rf24_datarate_e speed = RF24_1MBPS;
	//rf24_datarate_e speed = RF24_250KBPS;
	uint8_t channel = 97;

   gw.begin( (uint8_t)0, channel, speed );
   radio.setPALevel( RF24_PA_LOW );
   //gw.begin();

  //Config for use with RF24Mesh as child Node
  // uint8_t nodeID = 1;
  // gw.begin(nodeID);
 
 
  //Config for use without RF24Mesh
  // uint16_t RF24NetworkAddress = 0; 
  // gw.begin(RF24NetworkAddress);
  
  //Set this to your chosen IP/Subnet
  char ip[] = "10.10.2.2";
  char subnet[] = "255.255.255.0";
  
  gw.setIP(ip,subnet);
  radio.maskIRQ(1,1,0);
  attachInterrupt(23, INT_EDGE_FALLING, intHandler);

  
  
 while(1){
    
    gw.update();
	// The gateway handles all IP traffic (marked as EXTERNAL_DATA_TYPE) and passes it to the associated network interface
	// RF24Network user payloads are loaded into the user cache
	if( network.available() ){
	  RF24NetworkHeader header;
		size_t size = network.peek(header);
		uint8_t buf[size];
	    network.read(header,&buf,size);
	  printf("Received Network Message, type: %d id %d from %d\n",header.type,header.id,mesh.getNodeID(header.from_node));
	}
   

  }
  return 0;
}
