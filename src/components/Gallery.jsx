import pic1 from "../assets/pic1.jpg";
import pic2 from "../assets/pic2.jpg";
import pic3 from "../assets/pic3.jpg";
import pic4 from "../assets/pic4.jpg";
import pic5 from "../assets/pic5.jpg";
import pic6 from "../assets/pic6.jpg";
import "./Gallery.css"; // import the CSS file

function Gallery() {
  const images = [pic1, pic2, pic3, pic4, pic5, pic6];

  return (
    <div className="gallery-container">
      {images.map((img, index) => (
        <img key={index} src={img} alt={`pic${index + 1}`} className="gallery-image" />
      ))}
    </div>
  );
}

export default Gallery;
